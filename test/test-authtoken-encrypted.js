/*jslint node:true, unused:vars */
/*global before,it,describe, after */
var express = require( 'express' ), restify = require('restify'),
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
	userHeader = "X-CS-User".toLowerCase(),
	userInfo = JSON.stringify( {
		name: "john",
		pass: "1234",
		age: 25,
		id: 1,
		roles: [ "admin" ]
	} ),
	path = "/public",
	alltests = function () {
		it( 'should reject invalid token', function ( done ) {
			r.get( path )
				.set( authHeader, "blahblah" )
				.expect( 200 )
				.expect( authHeader, "error=invalidtoken", done );
		} );
		it( 'should reject expired token', function ( done ) {
			var token = tokenlib.generate( "john", "1234", Date.now() - ( 24 * 60 * 60 * 1000 ) );
			r.get( path )
				.set( authHeader, token )
				.expect( 200 )
				.expect( authHeader, "error=invalidtoken", done );
		} );
		it( 'should accept a valid token', function ( done ) {
			var token = tokenlib.generate( "john", "1234", Date.now() + 15 * 60 * 1000 ),
				re = /^success=/;
			r.get( path )
				.set( authHeader, token )
				.expect( 200 )
				.expect( authHeader, re, done );
		} );
		it( 'should accept a valid token with user and date', function ( done ) {
			var user = "john",
				expiry = Date.now() + 15 * 60 * 1000,
				token = tokenlib.generate( user, "1234", expiry ),
				re = /^success=/;
			r.get( path )
				.set( authHeader, token )
				.expect( 200 )
				.expect( authHeader, re, done );
		} );
		it( 'should allow to reuse a token', function ( done ) {
			var user = "john",
				token = tokenlib.generate( user, "1234", Date.now() + 15 * 60 * 1000 ),
				successRe = /^success=(.+)$/;

			async.waterfall( [

				function ( cb ) {
					r.get( path )
						.set( authHeader, token )
						.expect( 200 )
						.expect( authHeader, successRe )
						.expect( userHeader, tokenlib.cipher(userInfo), cb );
				},
				function ( res, cb ) {
					var match = res.headers[ authHeader ].match( successRe );
					r.get( path )
						.set( authHeader, match[ 1 ] )
						.expect( 200 )
						.expect( authHeader, successRe )
						.expect( userHeader, tokenlib.cipher(userInfo), cb );
				},
				function ( res, cb ) {
					var match = res.headers[ authHeader ].match( successRe ),
					decipherToken = /(([^:]*):([^:]*):([^:]*))$/;
					match = tokenlib.decipher( match[ 1 ] )	.match( decipherToken );

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
			cansec = cs.initEncrypted();
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
			cansec = cs.initEncrypted();
			app = restify.createServer();
			app.use( cansec.validate );
			app.get( path, function ( req, res, next ) {
				// send a 200
				require('../lib/sender')(res,200);
			} );
			r = request( app );
		} );
		after(function(){
			app.close();
		});
		alltests();
	});
} );