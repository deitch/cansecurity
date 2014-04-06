/*global module, require, Buffer */
var _ = require( 'lodash' ),
	crypto = require( 'crypto' ),
	tokenlib = require( './token' ),
	getUser, publicMethods, validatePass, validate,
	errors = require( './errors' ),
	constants = require( './constants' ).get();

var USERHEADER = constants.header.USER,
	AUTHHEADER = constants.header.AUTH,
	AUTHMETHODHEADER = constants.header.AUTHMETHOD,
	AUTHSESSION = AUTHHEADER,
	CORSHEADER = constants.header.CORS,
	SESSIONEXPIRY = 15, // minutes
	sessionExpiry, hasInit = false,
	encryptHeader = false,
	RANDOM_STRING_LENGTH = 60;

/*jslint regexp:true */
var MSGRE = /^error=(.+)$/;
/*jslint regexp:false */

module.exports = {
	init: function ( config ) {
		validate = fnOrNull( config.validate );
		getUser = fnOrNull( config.getUser );
		validatePass = fnOrNull( config.validatePassword );
		sessionExpiry = ( config.expiry || SESSIONEXPIRY ) * 60 * 1000;
		encryptHeader = ( config.encryptHeader || false );
		tokenlib.init( config.sessionKey || genRandomString( RANDOM_STRING_LENGTH ), encryptHeader );
		hasInit = true;
		return publicMethods;
	}
};

var publicMethods = {
	// if there is a login session token, refresh its timeout on each request, and validate it
	validate: function ( req, res, next ) {
		"use strict";

		tryStartSessionWithBasicAuthCredentials( req, res, next ) ||
			tryStartWithPreviousSessionData( req, res, next ) ||
			tryStartSessionWithAuthToken( req, res, next ) ||
			cantStablishSession( req, res, next );
	},
	clear: endSession,
	message: function ( res ) {
		var msg, p = res.headers ? ( res.headers[ AUTHHEADER ] || res.headers[ AUTHHEADER.toLowerCase() ] || "" ) : "",
			match = MSGRE.exec( p );

		msg = match && match.length > 1 && match[ 1 ].length > 0 ? match[ 1 ] : "";
		return ( msg );
	},
	getAuthMethod: function ( req ) {
		return ( req ? req[ AUTHMETHODHEADER ] : null );
	},
	getUser: function ( req ) {
		if ( req ) {
			return encryptHeader ? tokenlib.cipher( req[ AUTHHEADER ] ) : req[ AUTHHEADER ];
		}
		return null;
	}
};

var tryStartSessionWithBasicAuthCredentials = function ( req, res, next ) {
	var creds = getAuthCredentials( req );
	if ( creds ) {
		var validateFunc = validate || validatePass;
		var validateCallbackFunc = ( validate ? validateCallback : validateLegacyCallback );

		var context = {
			req: req,
			res: res,
			next: next,
			creds: creds
		};
		validateFunc( creds.user, creds.password, validateCallbackFunc.bind( context ) );
		return true;
	}
	return false;
};

var tryStartWithPreviousSessionData = function ( req, res, next ) {
	var session = getSessionDataFromRequest( req );

	if ( session.user ) {
		if ( session.auth.expiry > Date.now() ) {
			startSession( {
				req: req,
				res: res,
				user: session.user,
				login: session.auth.login,
				password: session.user.pass
			} );
		} else {
			endSession( req, res );
		}
		next();
		return true;
	}

	return false;
};

var tryStartSessionWithAuthToken = function ( req, res, next ) {
	var auth = getAuthTokenFromHeaders( req );
	if ( auth ) {
		if ( auth.valid ) {
			var context = {
				req: req,
				res: res,
				next: next,
				auth: auth
			};

			if ( validate ) {
				validate( auth.user, undefined, validateWithAuthTokenCallback.bind( context ) );
			} else if ( getUser ) {
				getUser(
					auth.user,
					validateGetUserSuccessCallback.bind( context ),
					validateGetUserFailureCallback.bind( context )
				);
			}
		} else {
			endSessionWithErrorMessage( req, res, errors.invalidtoken() );
			next();
		}
		return true;
	}
	return false;
};

var cantStablishSession = function ( req, res, next ) {
	endSession( req, res );
	next();
};

var genRandomString = function ( length ) {
	return crypto.getRandomBytes( length )
		.toString( 'hex' );
};

var startSession = function ( config ) {
	var req = config.req,
		res = config.res,
		expiry = Date.now() + sessionExpiry;

	appendCORSHeader( res );
	setupSessionData( req, config.user, config.login, expiry );
	setupSessionHeaders( req, res, config.user, config.login, config.password, config.method, expiry );
};

var appendCORSHeader = function ( response ) {
	var existing = response.get( CORSHEADER ) || "";
	response.set( CORSHEADER, _.compact( existing.split( /,/ ) )
		.concat( [ AUTHHEADER, USERHEADER ] )
		.join( "," ) );
};

var setupSessionData = function ( request, user, login, expiry ) {
	if ( request.session ) {
		request.session[ AUTHSESSION ] = {
			user: user,
			login: login,
			expiry: expiry
		};
		request.session.touch();
	}
};

var setupSessionHeaders = function ( request, response, user, login, password, method, expiry ) {
	request[ AUTHHEADER ] = user || {};
	request[ AUTHMETHODHEADER ] = method;
	userAsJson = JSON.stringify( request[ AUTHHEADER ] );
	response.header( AUTHHEADER, "success=" + tokenlib.generate( login, password, expiry ) );
	response.header( USERHEADER, encryptHeader ? tokenlib.cipher( userAsJson ) : userAsJson );
};

var endSession = function ( request, response ) {
	removeSessionData( request );
	clearHeaders( response );
};

var endSessionWithErrorMessage = function ( request, response, message ) {
	removeSessionData( request );
	prepareErrorHeaders( response, message );
};

var removeSessionData = function ( request ) {
	if ( request.session ) {
		delete request.session[ AUTHSESSION ];
	}
};

var clearHeaders = function ( response ) {
	response.removeHeader( AUTHHEADER );
	response.removeHeader( USERHEADER );
};

var prepareErrorHeaders = function ( response, message ) {
	response.header( AUTHHEADER, "error=" + message );
	response.removeHeader( USERHEADER );
};

var getSessionDataFromRequest = function ( request ) {
	var session = {};
	if ( request.session ) {
		session.auth = request.session[ AUTHSESSION ] || null;
		if ( session.auth ) {
			session.user = session.auth.user;
		}
	}
	return session;
};

var getAuthTokenFromHeaders = function ( req ) {
	var authToken = req.headers[ AUTHHEADER ] || req.headers[ AUTHHEADER.toLowerCase() ];

	if ( !authToken ) return null;

	if ( encryptHeader ) {
		authToken = tokenlib.decipher( authToken );
	}

	var authTokenParts = authToken.split( ':' );
	var auth = {
		valid: authTokenParts.length >= 2,
		token: authToken,
		hash: authTokenParts[ 0 ],
		user: authTokenParts[ 1 ],
		expiry: authTokenParts[ 2 ]
	};

	return auth;
};

var getAuthCredentials = function ( req ) {
	if ( requestHasBasicAuthCredentials( req ) ) {
		return getBasicAuthCredentials( req );
	}
	return null;
};

var requestHasBasicAuthCredentials = function ( request ) {
	return request.headers.authorization && request.headers.authorization.indexOf( "Basic " ) === 0;
};

var getBasicAuthCredentials = function ( request ) {
	header = new Buffer( request.headers.authorization.split( ' ' )[ 1 ], 'base64' )
		.toString()
		.split( ":" );
	if ( header && header.length === 2 ) {
		return {
			user: header[ 0 ],
			password: header[ 1 ]
		};
	}
	return null;
};


///////////////////
//// CALLBACKS ////
///////////////////

var validateCallback = function ( success, user, message, pass ) {
	if ( success && user ) {
		startSession( {
			req: this.req,
			res: this.res,
			user: user,
			login: this.creds.user,
			password: pass,
			method: constants.method.CREDENTIALS
		} );
		this.next();
	} else {
		endSessionWithErrorMessage( this.req, this.res, message );
		this.res.send( 401, errors.unauthenticated( message ) );
	}
};

var validateLegacyCallback = function ( user, message, pass ) {
	if ( user ) {
		startSession( {
			req: this.req,
			res: this.res,
			user: user,
			login: this.creds.user,
			password: pass,
			method: constants.method.CREDENTIALS
		} );
		this.next();
	} else {
		endSessionWithErrorMessage( this.req, this.res, message );
		this.res.send( 401, errors.unauthenticated( message ) );
	}
};

var validateWithAuthTokenCallback = function ( success, user, login, pass ) {
	var authToken = this.auth.token;
	if ( success && tokenlib.validate( authToken, login, pass ) ) {
		startSession( {
			req: this.req,
			res: this.res,
			user: user,
			login: login,
			password: pass,
			method: constants.method.TOKEN
		} );
	} else {
		endSessionWithErrorMessage( this.req, this.res, errors.invalidtoken() );
	}
	this.next();
};

var validateGetUserSuccessCallback = function ( user, login, password ) {
	var authToken = this.auth.token;
	if ( tokenlib.validate( authToken, login, password ) ) {
		startSession( {
			req: this.req,
			res: this.res,
			user: user,
			login: login,
			password: password,
			method: constants.method.TOKEN
		} );
	} else {
		endSessionWithErrorMessage( this.req, this.res, errors.invalidtoken() );
	}
	this.next();
};

var validateGetUserFailureCallback = function () {
	endSessionWithErrorMessage( this.req, this.res, errors.invalidtoken() );
	this.next();
};

///////////////
//// UTILS ////
///////////////

var fnOrNull = function ( f ) {
	return ( f && typeof ( f ) === "function" ? f : null );
};