/*global module, require, Buffer, console */
var _ = require( 'lodash' ),
	crypto = require( 'crypto' ),
	tokenlib = require( './token' ),
	util = require('./util'),
	now = util.now,
	publicMethods, validate, invalidTokenMessage,
	errors = require( './errors' ),
	sender = require('./sender'),
	constants = require( './constants' ).get(),
	debug = false,
	warn = function (msg) {
		if (debug) {
			console.error(msg);
		}
	};

// set up warn on tokenlib
tokenlib.setWarn(warn);

var AUTHHEADER = constants.header.AUTH,
	AUTHMETHODHEADER = constants.header.AUTHMETHOD,
	AUTHSESSION = AUTHHEADER,
	CORSHEADER = constants.header.CORS,
	SESSIONEXPIRY = 15, // minutes
	sessionExpiry, hasInit = false,
	encryptHeader = false,
	RANDOM_STRING_LENGTH = 60;

/*jslint regexp:true */
var MSGRE = /^error (.+)$/;
/*jslint regexp:false */

///////////////
//// UTILS ////
///////////////

var fnOrNull = function ( f ) {
	return ( f && typeof ( f ) === "function" ? f : null );
},
genRandomString = function ( length ) {
	return crypto.randomBytes( length )
		.toString( 'hex' );
};


/////////////////////
//// CREDENTIALS ////
/////////////////////

var requestHasBasicAuthCredentials = function ( request ) {
	return request.headers.authorization && request.headers.authorization.indexOf( "Basic " ) === 0;
}, getBasicAuthCredentials = function ( request ) {
	var header = new Buffer( request.headers.authorization.split( ' ' )[ 1 ], 'base64' )
		.toString()
		.split( ":" );
	if ( header && header.length === 2 ) {
		return {
			user: header[ 0 ],
			password: header[ 1 ]
		};
	}
	return null;
}, getAuthCredentials = function ( req ) {
	if ( requestHasBasicAuthCredentials( req ) ) {
		return getBasicAuthCredentials( req );
	}
	return null;
}, appendCORSHeader = function ( response ) {
	var existing = response.get( CORSHEADER ) || "";
	response.set( CORSHEADER, _.compact( existing.split( /,/ ) )
		.concat( [ AUTHHEADER ] )
		.join( "," ) );
},
getAuthTokenFromHeaders = function ( req ) {
	var header = req.headers.authorization,
	authToken = header && header.indexOf("Bearer ") === 0 ? header.split(' ')[1] : null;

	return authToken;
	/*
	if ( !authToken ) {return null;}

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
	*/
};


/////////////////
//// SESSION ////
/////////////////

var setupSessionData = function ( request, user, login, expiry ) {
	if ( request.session ) {
		request.session[ AUTHSESSION ] = {
			user: user,
			login: login,
			expiry: expiry
		};
		request.session.touch();
	}
},
setupSessionHeaders = function ( request, response, user, login, method, expiry ) {
	var userAsJson, header;
	request[ AUTHHEADER ] = user || {};
	request[ AUTHMETHODHEADER ] = method;
	userAsJson = JSON.stringify( request[ AUTHHEADER ] );
	header = [
		"success",
		tokenlib.generate( login, userAsJson, expiry ),
		login,
		expiry
	];	response.header( AUTHHEADER, header.join(" "));
},
removeSessionData = function ( request ) {
	if ( request.session ) {
		delete request.session[ AUTHSESSION ];
	}
},
clearHeaders = function ( response ) {
	response.removeHeader( AUTHHEADER );
},
endSession = function ( request, response ) {
	removeSessionData( request );
	clearHeaders( response );
},
cantStablishSession = function ( req, res, next ) {
	endSession( req, res );
	next();
},
prepareErrorHeaders = function ( response, message ) {
	response.header( AUTHHEADER, "error " + message );
},
endSessionWithErrorMessage = function ( request, response, message ) {
	removeSessionData( request );
	prepareErrorHeaders( response, message );
},
getSessionDataFromRequest = function ( request ) {
	var session = {};
	if ( request.session ) {
		session.auth = request.session[ AUTHSESSION ] || null;
		if ( session.auth ) {
			session.user = session.auth.user;
		}
	}
	return session;
},
startSession = function ( config ) {
	var req = config.req,
		res = config.res,
		expiry = now() + sessionExpiry;

	appendCORSHeader( res );
	setupSessionData( req, config.user, config.login, expiry );
	setupSessionHeaders( req, res, config.user, config.login, config.method, expiry );
};




///////////////////
//// CALLBACKS ////
///////////////////

var validateCallback = function ( success, user, message, pass ) {
	if ( success && user ) {
		warn("Successfully validated "+user+" via basic auth");
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
		warn("Failed to validate user via basic auth");
		endSessionWithErrorMessage( this.req, this.res, message );
		sender(this.res, 401, errors.unauthenticated( message ) );
	}
};

//////////////////////////
//// SESSION CREATION ////
//////////////////////////

var tryStartSessionWithBasicAuthCredentials = function ( req, res, next ) {
	var creds = getAuthCredentials( req );
	warn("Try Session with Basic Auth Creds for "+req.url);
	if ( creds ) {
		warn("Basic Auth Creds found for "+creds.user);

		var context = {
			req: req,
			res: res,
			next: next,
			creds: creds
		};
		validate( creds.user, creds.password, validateCallback.bind( context ) );
		return true;
	}
	return false;
},
tryStartWithPreviousSessionData = function ( req, res, next ) {
	var session = getSessionDataFromRequest( req ), ret;
	warn("Try Session with Previous express session data for "+req.url);

	if ( session.user ) {
		warn("Session user found");
		if ( session.auth.expiry > now() ) {
			warn("Session still valid");
			startSession( {
				req: req,
				res: res,
				user: session.user,
				login: session.auth.login,
				password: session.user.pass
			} );
		} else {
			warn("Session expired");
			endSession( req, res );
		}
		next();
		ret = true;
	} else {
		warn("No previous session user found");
		ret = false;
	}

	return ret;
},
tryStartSessionWithAuthToken = function ( req, res, next ) {
	var auth = getAuthTokenFromHeaders( req ), ret, token, login;
	warn("Try Session with Auth Token for "+req.url);
	if ( auth ) {
		warn("Auth Token found");

		// first validate the token
		token = tokenlib.validate( auth );

		// if succeeded, then we need to validate the user from the DB
		if ( token ) {
			login = token.sub;
			warn("Successfully validated "+login+" via auth token");

			if ( validate ) {
				warn("Trying to check user ...");
				validate( token.sub, undefined, function (success, user ) {
					warn("Tried validation, success? "+success);
					if (success) {
						startSession( {
							req: req,
							res: res,
							user: user,
							login: login,
							method: constants.method.TOKEN
						} );
						next();
					}
				} );
			}
		} else {
			warn("Failed to validate "+login+" via auth token");
			endSessionWithErrorMessage( req, res, errors.invalidtoken( invalidTokenMessage ) );
			sender(res, 401, errors.invalidtoken( invalidTokenMessage ) );
		}
		ret = true;
	} else {
		warn("No auth token found");
		ret = false;
	}
	return ret;
};



/////////////////
//// METHODS ////
/////////////////

publicMethods = {
	// if there is a login session token, refresh its timeout on each request, and validate it
	validate: function ( req, res, next ) {
		"use strict";
		return tryStartSessionWithBasicAuthCredentials( req, res, next ) ||
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
			return req[ AUTHHEADER ];
		}
		return null;
	}
};

module.exports = {
	init: function ( config ) {
		validate = fnOrNull( config.validate );
		invalidTokenMessage = config.invalidTokenMessage || null;
		sessionExpiry = ( config.expiry || SESSIONEXPIRY ) * 60 * 1000;
		encryptHeader = ( config.encryptHeader || false );
		tokenlib.init( config.sessionKey || genRandomString( RANDOM_STRING_LENGTH ), encryptHeader );
		debug = config.debug || false;
		hasInit = true;
		return publicMethods;
	}
};
