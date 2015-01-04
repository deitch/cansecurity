/*jslint node:true, nomen:true */
var _ = require( 'lodash' ),
	tokenLib = require("../../lib/token"),
	cs = require( '../../lib/index' ),
	user = {
		"1": {
			name: "john",
			pass: "1234",
			age: 25,
			id: 1,
			roles: [ "admin" ]
		},
		"2": {
			name: "jill",
			pass: "1234",
			age: 30,
			id: "2"
		},
		"3": {
			name: "norole",
			pass: "1234",
			id: "3"
		},
		"4": {
			name: "userrole",
			pass: "1234",
			id: "4",
			roles: [ "user", "regular" ]
		}
	}, SESSIONKEY = "ABCDEFG";

module.exports = {
	init: function () {
		return cs.init( {
			validate: function ( login, pass, callback ) {
				var found = null;
				// search for our user
				_.each( user, function ( val, key ) {
					var ret = true;
					if ( val.name === login ) {
						found = val;
						ret = false;
					}
					return ( ret );
				} );
				if ( !found ) {
					callback( false, null, "invaliduser" );
				} else if ( pass === undefined ) {
					callback( true, found, found.name, found.pass );
				} else if ( pass === found.pass ) {
					callback( true, found, found.name, found.pass );
				} else {
					callback( false, null, "invalidpass" );
				}
			},
			loader: {
				group: function ( req, res, next ) {
					req.cansecurity.item = 1;
					next();
				}
			},
			sessionKey: SESSIONKEY
		} );
	},
	initEncrypted: function () {
		return cs.init( {
			validate: function ( login, pass, callback ) {
				var found = null;
				// search for our user
				_.each( user, function ( val, key ) {
					var ret = true;
					if ( val.name === login ) {
						found = val;
						ret = false;
					}
					return ( ret );
				} );
				if ( !found ) {
					callback( false, null, "invaliduser" );
				} else if ( pass === undefined ) {
					callback( true, found, found.name, found.pass );
				} else if ( pass === found.pass ) {
					callback( true, found, found.name, found.pass );
				} else {
					callback( false, null, "invalidpass" );
				}
			},
			loader: {
				group: function ( req, res, next ) {
					req.cansecurity.item = 1;
					next();
				}
			},
			sessionKey: SESSIONKEY,
			encryptHeader: true
		} );
	},
	initTokenLib: function ( encrypt ) {
		tokenLib.init(SESSIONKEY, encrypt || false);
		return tokenLib;
	},
	initLegacy: function () {
		return cs.init( {
			getUser: function ( login, success, failure ) {
				var found = null;
				// search for our user
				_.each( user, function ( val, key ) {
					var ret = true;
					if ( val.name === login ) {
						found = val;
						ret = false;
					}
					return ( ret );
				} );
				if ( found ) {
					success( found, found.name, found.pass );
				} else {
					failure();
				}
			},
			validatePassword: function ( login, pass, cb ) {
				var p = null,
					message = "invaliduser",
					resuser = null;
				// search for our user
				_.each( user, function ( val, key ) {
					var ret = true;
					if ( val.name === login ) {
						ret = false;
						if ( val.pass === pass ) {
							message = null;
							resuser = val;
							p = pass;
						} else {
							message = "invalidpass";
						}
					}
					return ( ret );
				} );
				cb( resuser, message, p );
			},
			sessionKey: SESSIONKEY
		} );
	}
};