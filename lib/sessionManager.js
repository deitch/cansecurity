/*global module, require, Buffer */
var _ = require( 'lodash' ),
	crypto = require( 'crypto' ),
	tokenlib = require( './token' ),
	getUser, publicMethods, validatePass, validate,
	errors = require( './errors' );

var USERHEADER = "X-CS-User",
	AUTHHEADER = "X-CS-Auth",
	AUTHMETHODHEADER = AUTHHEADER + ".method",
	AUTHSESSION = AUTHHEADER,
	CORSHEADER = 'Access-Control-Expose-Headers',
	SESSIONEXPIRY = 15, // minutes
	sessionExpiry, hasInit = false,
	encryptHeader = false;

var CREDENTIALS_METHOD = "credentials",
	TOKEN_METHOD = "token";

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
		tokenlib.init( config.sessionKey || genRandomString( 64 ), encryptHeader );
		hasInit = true;
		return publicMethods;
	}
};

var publicMethods = {
	// if there is a login session token, refresh its timeout on each request, and validate it
	validate: function ( req, res, next ) {
		"use strict";
		var creds = getAuthCredentials( req );
		if ( creds ) {
			var validateFunc = validate || validatePass;
			var validateCallbackFunc = (validate ? validateCallback : validateLegacyCallback);
			
			return validateFunc(creds.user, creds.password, validateCallbackFunc.bind({req: req, res:res, next:next, creds: creds}));
		} 

		var session = getSessionDataFromRequest( req );
		if ( session.user ) {
			// is it still valid?
			var expiry = session.auth.expiry;
			if ( expiry > Date.now() ) {
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
			return next();
		}

		var auth = getAuthenticationHeaders( req );
		if ( auth ) {
			var authParts = auth.split( ":" );
			if ( authParts && authParts.length >= 2 ) {
				if ( validate ) {
					validate( authParts[ 1 ], undefined, function ( success, user, login, pass ) {
						if ( success && tokenlib.validate( auth, login, pass ) ) {
							startSession( {
								req: req,
								res: res,
								user: user,
								login: login,
								password: pass,
								method: TOKEN_METHOD
							} );
						} else {
							endSessionWithErrorMessage( req, res, errors.invalidtoken() );
						}
						return next();
					} );
				} else if ( getUser ) {
					getUser( authParts[ 1 ], function ( user, login, password ) {
						if ( tokenlib.validate( auth, login, password ) ) {
							startSession( {
								req: req,
								res: res,
								user: user,
								login: login,
								password: password,
								method: TOKEN_METHOD
							} );
						} else {
							endSessionWithErrorMessage( req, res, errors.invalidtoken() );
						}
						next();
					}, function () {
						endSessionWithErrorMessage( req, res, errors.invalidtoken() );
						next();
					} );
				}
			} else {
				endSessionWithErrorMessage( req, res, errors.invalidtoken() );
				next();
			}
		} else {
			endSession( req, res );
			next();
		}
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
		return ( req ? req[ AUTHHEADER ] : null );
	}
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
	response.header( AUTHHEADER, "success=" + tokenlib.generate( login, password, expiry ) );
	response.header( USERHEADER, JSON.stringify( request[ AUTHHEADER ] ) );
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

var getAuthenticationHeaders = function ( req ) {
	var auth = req.headers[ AUTHHEADER ] || req.headers[ AUTHHEADER.toLowerCase() ];

	if ( encryptHeader ) {
		auth = tokenlib.decipher( auth );
	}

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

var validateCallback = function ( success, user, message, pass ) {
	if ( success && user ) {
		startSession( {
			req: this.req,
			res: this.res,
			user: user,
			login: this.creds.user,
			password: pass,
			method: CREDENTIALS_METHOD
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
			method: CREDENTIALS_METHOD
		} );
		this.next();
	} else {
		endSessionWithErrorMessage( this.req, this.res, message );
		this.res.send( 401, errors.unauthenticated( message ) );
	}
};

var fnOrNull = function ( f ) {
	return ( f && typeof ( f ) === "function" ? f : null );
};