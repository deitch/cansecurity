/*jslint node:true, nomen:true, unused:vars */
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
	init: function (param) {
		return cs.init( Object.assign({
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
				},
				local: function ( req, res, next ) {
					req.cansecurity.item = "global";
					next();
				}
			}
		}, param || {}) );
	},
	initTokenLib: function ( encrypt ) {
		tokenLib.init({key: SESSIONKEY, encrypt: encrypt || false});
		return tokenLib;
	}
};
