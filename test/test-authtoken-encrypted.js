/*jslint node:true, unused:vars */
/*global before,it,describe */
var express = require( 'express' ), restify = require('restify'), jwt = require('jsonwebtoken'),
	app = express(),
	async = require( 'async' ),
	tokenlib = require( './resources/cs' ).initTokenLib(true),
	cansec,
	cookieParser = require('cookie-parser'),
	session = require('express-session'),
	cs = require( './resources/cs' ),
	request = require( 'supertest' ),
	r,
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
		var match = res.headers[ authHeader ].match( successRe ), decoded;
		// cannot decode until we decrypt
		decoded = jwt.decode(tokenlib.decipher(match[2]));
		return decoded["cs-user"] === userInfo;
	},
	now = function () {
		return Math.floor(Date.now()/1000);
	},
	path = "/public",
	alltests = function () {
		it( 'should reject invalid token', function ( done ) {
			r.get( path )
				.set( "Authorization", "Bearer blahblah" )
				.expect( 401 )
				.expect( authHeader, "error invalidtoken", done );
		} );
		it( 'should reject expired token', function ( done ) {
			var token = tokenlib.generate( "john", "1234", now() - ( 24 * 60 * 60 ) );
			r.get( path )
				.set( "Authorization", "Bearer "+token )
				.expect( 401 )
				.expect( authHeader, "error invalidtoken", done );
		} );
		it( 'should accept a valid token', function ( done ) {
			var token = tokenlib.generate( "john", "1234", now() + 15 * 60 ),
				re = /^success /;
			r.get( path )
				.set( "Authorization", "Bearer "+token )
				.expect( 200 )
				.expect( authHeader, re, done );
		} );
		it( 'should accept a valid token with user and date', function ( done ) {
			var user = "john",
				expiry = now() + 15 * 60,
				token = tokenlib.generate( user, "1234", expiry ),
				re = /^success /;
			r.get( path )
				.set( "Authorization", "Bearer "+token )
				.expect( 200 )
				.expect( authHeader, re, done );
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

describe( 'authtoken-encrypted', function () {
	describe('express', function(){
		before( function () {
			cansec = cs.init({encryptHeader: true});
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
			cansec = cs.init({encryptHeader: true});
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
} );
