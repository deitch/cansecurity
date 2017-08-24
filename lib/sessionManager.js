/*global module, require, Buffer, console */
const _ = require( 'lodash' ),
  crypto = require( 'crypto' ),
  tokenlib = require( './token' ),
  util = require('./util'),
  errors = require( './errors' ),
  sender = require('./sender'),
  constants = require( './constants' ).get(),
  now = util.now,
  warn = function (msg) {
    if (debug) {
      console.error(msg);
    }
  };

const AUTHHEADER = constants.header.AUTH,
  AUTHMETHODHEADER = constants.header.AUTHMETHOD,
  AUTHSESSION = AUTHHEADER,
  CORSHEADER = constants.header.CORS,
  SESSIONEXPIRY = 15, // minutes
  RANDOM_STRING_LENGTH = 60,

  /*jslint regexp:true */
  MSGRE = /^error (.+)$/;
  /*jslint regexp:false */

let validate, invalidTokenMessage, debug = false, sessionExpiry,
  encryptHeader = false;



// set up warn on tokenlib
tokenlib.setWarn(warn);


///////////////
//// UTILS ////
///////////////

const fnOrNull = ( f ) => ( f && typeof ( f ) === "function" ? f : null ),
  genRandomString = ( length ) => crypto.randomBytes( length ).toString( 'hex' )
;


/////////////////////
//// CREDENTIALS ////
/////////////////////

const requestHasBasicAuthCredentials = ( request ) => request.headers.authorization && request.headers.authorization.indexOf( "Basic " ) === 0,
  getBasicAuthCredentials = ( request ) => {
    const header = new Buffer( request.headers.authorization.split( ' ' )[ 1 ], 'base64' )
      .toString()
      .split( ":" );
    if ( header && header.length === 2 ) {
      return {
        user: header[ 0 ],
        password: header[ 1 ]
      };
    }
    return null;
  },
  getAuthCredentials = ( req ) => requestHasBasicAuthCredentials( req ) ? getBasicAuthCredentials( req ) : null,
  appendCORSHeader = ( response ) => {
    const existing = response.get( CORSHEADER ) || "";
    response.set( CORSHEADER, _.compact( existing.split( /,/ ) )
      .concat( [ AUTHHEADER ] )
      .join( "," ) );
  },
  getAuthTokenFromHeaders = ( req ) => {
    const header = req.headers.authorization,
      authToken = header && header.indexOf("Bearer ") === 0 ? header.split(' ')[1] : null;

    return authToken;
  };


/////////////////
//// SESSION ////
/////////////////

const setupSessionData = ( request, user, login, expiry ) => {
    if ( request.session ) {
      request.session[ AUTHSESSION ] = {
        user: user,
        login: login,
        expiry: expiry
      };
      request.session.touch();
    }
  },
  setupSessionHeaders = ( request, response, user, login, method, expiry ) => {
    const u = user || {}, userAsJson = JSON.stringify(u),
      header = [
        "success",
        tokenlib.generate( login, userAsJson, expiry ),
        login,
        expiry
      ];
    request[ AUTHHEADER ] = u;
    request[ AUTHMETHODHEADER ] = method;
    response.header( AUTHHEADER, header.join(" "));
  },
  removeSessionData = ( request ) => {
    if ( request.session ) {
      delete request.session[ AUTHSESSION ];
    }
  },
  clearHeaders = ( response ) => {
    response.removeHeader( AUTHHEADER );
  },
  endSession = ( request, response ) => {
    removeSessionData( request );
    clearHeaders( response );
  },
  cantStablishSession = ( req, res, next ) => {
    endSession( req, res );
    next();
  },
  prepareErrorHeaders = ( response, message ) => {
    response.header( AUTHHEADER, "error " + message );
  },
  endSessionWithErrorMessage = ( request, response, message ) => {
    removeSessionData( request );
    prepareErrorHeaders( response, message );
  },
  getSessionDataFromRequest = ( request ) => {
    const session = {};
    if ( request.session ) {
      session.auth = request.session[ AUTHSESSION ] || null;
      if ( session.auth ) {
        session.user = session.auth.user;
      }
    }
    return session;
  },
  startSession = ( config ) => {
    const req = config.req,
      res = config.res,
      expiry = now() + sessionExpiry;

    appendCORSHeader( res );
    setupSessionData( req, config.user, config.login, expiry );
    setupSessionHeaders( req, res, config.user, config.login, config.method, expiry );
  };




///////////////////
//// CALLBACKS ////
///////////////////

const validateCallback = function( success, user, message, pass ) {
  if ( success && user ) {
    warn(`Successfully validated ${user} via basic auth`);
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
    warn(`Failed to validate user via basic auth`);
    endSessionWithErrorMessage( this.req, this.res, message );
    sender(this.res, 401, errors.unauthenticated( message ) );
  }
};

//////////////////////////
//// SESSION CREATION ////
//////////////////////////

const tryStartSessionWithBasicAuthCredentials = ( req, res, next ) => {
    const creds = getAuthCredentials( req );
    warn(`Try Session with Basic Auth Creds for ${req.url}`);
    if ( creds ) {
      warn(`Basic Auth Creds found for ${creds.user}`);

      const context = {
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
  tryStartWithPreviousSessionData = ( req, res, next ) => {
    const session = getSessionDataFromRequest( req );
    let ret;
    warn(`Try Session with Previous express session data for ${req.url}`);

    if ( session.user ) {
      warn(`Session user found`);
      if ( session.auth.expiry > now() ) {
        warn(`Session still valid`);
        startSession( {
          req: req,
          res: res,
          user: session.user,
          login: session.auth.login,
          password: session.user.pass
        } );
      } else {
        warn(`Session expired`);
        endSession( req, res );
      }
      next();
      ret = true;
    } else {
      warn(`No previous session user found`);
      ret = false;
    }

    return ret;
  },
  tryStartSessionWithAuthToken = ( req, res, next ) => {
    const auth = getAuthTokenFromHeaders( req );
    let ret, token, login;
    warn("Try Session with Auth Token for "+req.url);
    if ( auth ) {
      warn(`Auth Token found`);

      // first validate the token
      token = tokenlib.validate( auth );

      // if succeeded, then we need to validate the user from the DB
      if ( token ) {
        login = token.sub;
        warn(`Successfully validated ${login} via auth token`);

        if ( validate ) {
          warn(`Trying to check user ...`);
          validate( token.sub, undefined, function (success, user ) {
            warn(`Tried validation, success? ${success}`);
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
        warn(`Failed to validate ${login} via auth token`);
        endSessionWithErrorMessage( req, res, errors.invalidtoken( invalidTokenMessage ) );
        sender(res, 401, errors.invalidtoken( invalidTokenMessage ) );
      }
      ret = true;
    } else {
      warn(`No auth token found`);
      ret = false;
    }
    return ret;
  };



/////////////////
//// METHODS ////
/////////////////

const publicMethods = {
  // if there is a login session token, refresh its timeout on each request, and validate it
  validate: ( req, res, next ) => {
    "use strict";
    return tryStartSessionWithBasicAuthCredentials( req, res, next ) ||
      tryStartWithPreviousSessionData( req, res, next ) ||
      tryStartSessionWithAuthToken( req, res, next ) ||
      cantStablishSession( req, res, next );
  },
  clear: endSession,
  message: ( res ) => {
    const p = res.headers ? ( res.headers[ AUTHHEADER ] || res.headers[ AUTHHEADER.toLowerCase() ] || "" ) : "",
      match = MSGRE.exec( p ),
      msg = match && match.length > 1 && match[ 1 ].length > 0 ? match[ 1 ] : "";

    return ( msg );
  },
  getAuthMethod: ( req ) => ( req ? req[ AUTHMETHODHEADER ] : null ),
  getUser: ( req ) => req ? req[ AUTHHEADER ] : null
};

module.exports = {
  init: ( config ) => {
    validate = fnOrNull( config.validate );
    invalidTokenMessage = config.invalidTokenMessage || null;
    sessionExpiry = ( config.expiry || SESSIONEXPIRY ) * 60 * 1000;
    encryptHeader = ( config.encryptHeader || false );
    debug = config.debug || false;

    tokenlib.init( config.sessionKey || genRandomString( RANDOM_STRING_LENGTH ), encryptHeader );

    return publicMethods;
  }
};
