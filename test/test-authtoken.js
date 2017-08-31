/*jslint node:true, unused:vars */
/*global before,it,describe */
var express = require( 'express' ), restify = require('restify'),
	fs = require('fs'),
	path = require('path'),
	jwt = require('jsonwebtoken'),
	app,
	async = require( 'async' ),
	cansec,
	cs = require( './resources/cs' ),
	privKey = fs.readFileSync(path.join(__dirname,'resources/rsa-private.pem')),
	pubKey = fs.readFileSync(path.join(__dirname,'resources/rsa-public.pem')),
	cookieParser = require('cookie-parser'),
	session = require('express-session'),
	tokenlib = require( '../lib/token' ),
	request = require( 'supertest' ),
	r,
	now = function () {
		return Math.floor(Date.now()/1000);
	},
	authHeader = "X-CS-Auth".toLowerCase(),
	userInfo = JSON.stringify( {
		name: "john",
		pass: "1234",
		age: 25,
		id: 1,
		roles: [ "admin" ]
	} ),
	successRe = /^success ((\S+)\s(\S+)\s(\S+))$/,
	checkUserInfo = function (res) {
		var match = res.headers[ authHeader ].match( successRe ),
		decoded = jwt.decode(match[2]);
		// take JWT (match[2]), split on '.', base64 decode 2nd part (claims),
		//   check that the 'cs-user' claim is identical to userInfo
		return decoded["cs-user"] === userInfo;
	},
	path = "/public",
	alltests = function () {
		it( 'should reject invalid token', function ( done ) {
			r.get( path ).set( "Authorization", "Bearer blahblah" ).expect( 401 ).expect( authHeader, "error invalidtoken", done );
		} );
		it( 'should reject expired token', function ( done ) {
			var token = tokenlib.generate( "john", "1234", now() - ( 24 * 60 * 60 ) );
			r.get( path ).set( "Authorization", "Bearer "+token ).expect( 401 ).expect( authHeader, "error invalidtoken", done );
		} );
		it( 'should accept a valid token', function ( done ) {
			var token = tokenlib.generate( "john", "1234", now() + 15 * 60 );
			r.get( path ).set( "Authorization", "Bearer "+token ).expect( 200 ).expect( authHeader, successRe, done );
		} );
		it( 'should accept a valid token with user and date', function ( done ) {
			var user = "john",
				expiry = now() + 15 * 60,
			token = tokenlib.generate( user, "1234", expiry );
			r.get( path ).set( "Authorization", "Bearer "+token ).expect( 200 ).expect( authHeader, successRe, done );
		} );
		it( 'should allow to reuse a token', function ( done ) {
			var user = "john",
			token = tokenlib.generate( user, "1234", now() + 15 * 60 );
			async.waterfall( [

				function ( cb ) {
					r.get( path )
						.set( "Authorization", "Bearer "+token )
						.expect( 200 )
						.expect( authHeader, successRe )
						.expect(function (res) {
							if (!checkUserInfo(res)) {
								throw new Error("unmatched userInfo "+tokenlib.cipher(userInfo));
							}
						})
						.end(cb);
				},
				function ( res, cb ) {
					var match = res.headers[ authHeader ].match( successRe );
					r.get( path )
						.set( "Authorization", "Bearer "+match[ 2 ] )
						.expect( 200 )
						.expect( authHeader, successRe )
						.expect(function (res) {
							if (!checkUserInfo(res)) {
								throw new Error("unmatched userInfo "+tokenlib.cipher(userInfo));
							}
						})
						.end(cb);
				},
				function ( res, cb ) {
					var match = res.headers[ authHeader ].match( successRe );
					if ( match[ 3 ] === user ) {
						cb();
					} else {
						cb( "unmatched name" );
					}
				}
			], done );
		} );
	};
describe( 'authtoken', function () {
	describe('sessionKey', function() {
		describe('express', function(){
			before( function () {
				cansec = cs.init();
				app = express();
				app.use( cookieParser() );
				app.use( session( {
					secret: "agf67dchkQ!",resave:false,saveUninitialized:false
				} ) );
				app.use( cansec.validate );
				app.get( path, function ( req, res, next ) {
					// send a 200
					require('../lib/sender')(res,200);
				} );
				r = request( app );
			} );
			alltests();
		});
		describe('restify', function(){
			before( function () {
				// we need to handle the mess that restify creates
				// we create a prototype chain for http.IncomingMessage, so when restify changes it, it changes the new middle layer,
				// which we can restore
				cansec = cs.init();
				app = restify.createServer();
				app.use( cansec.validate );
				app.get( path, function ( req, res, next ) {
					// send a 200
					require('../lib/sender')(res,200);
				} );
				r = request( app );
			} );
			alltests();
		});
	});
	describe('publicKey', function() {
		before( function () {
			cansec = cs.init({privateKey: privKey, publicKey: pubKey});
			app = express();
			app.use( cookieParser() );
			app.use( cansec.validate );
			app.get( path, function ( req, res, next ) {
				// send a 200
				require('../lib/sender')(res,200);
			} );
			r = request( app );
		} );
		alltests();
		describe('mismatched keys', function() {
			before( function () {
				cansec = cs.init({privateKey: privKey, publicKey: "abcdefg"});
				app = express();
				app.use( cookieParser() );
				app.use( cansec.validate );
				app.get( path, function ( req, res, next ) {
					// send a 200
					require('../lib/sender')(res,200);
				} );
				r = request( app );
			} );
			it( 'should reject mismatched token', function ( done ) {
				var user = "john",
					expiry = now() + 15 * 60,
				token = tokenlib.generate( user, "1234", expiry );
				r.get( path ).set( "Authorization", "Bearer "+token ).expect( 401 ).expect( authHeader, 'error invalidtoken', done );
			} );
		});
	});
} );
