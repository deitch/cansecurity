/*jslint node:true */
/*global before,it,describe */
var express = require( 'express' ),
	app,
	async = require( 'async' ),
	cansec,
	cs = require( './resources/cs' ),
	tokenlib = require( '../lib/token' ),
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
	path = "/public";
describe( 'authtoken', function () {
	before( function () {
		cansec = cs.init();
		app = express();
		app.use( express.cookieParser() );
		app.use( express.session( {
			secret: "agf67dchkQ!"
		} ) );
		app.use( cansec.validate );
		app.use( app.router );
		app.get( path, function ( req, res, next ) {
			res.send( 200 );
		} );
		r = request( app );
	} );
	it( 'should reject invalid token', function ( done ) {
		r.get( path ).set( authHeader, "blahblah" ).expect( 200 ).expect( authHeader, "error=invalidtoken", done );
	} );
	it( 'should reject expired token', function ( done ) {
		var token = tokenlib.generate( "john", "1234", new Date().getTime() - ( 24 * 60 * 60 * 1000 ) );
		r.get( path ).set( authHeader, token ).expect( 200 ).expect( authHeader, "error=invalidtoken", done );
	} );
	it( 'should accept a valid token', function ( done ) {
		var token = tokenlib.generate( "john", "1234", new Date().getTime() + 15 * 60 * 1000 ),
			re = /^success=/;
		r.get( path ).set( authHeader, token ).expect( 200 ).expect( authHeader, re, done );
	} );
	it( 'should accept a valid token with user and date', function ( done ) {
		var user = "john",
			expiry = new Date().getTime() + 15 * 60 * 1000,
			token = [ tokenlib.generate( user, "1234", expiry ), user, expiry ].join( ":" ),
			re = /^success=/;
		r.get( path ).set( authHeader, token ).expect( 200 ).expect( authHeader, re, done );
	} );
	it( 'should allow to reuse a token', function ( done ) {
		var user = "john",
			token = tokenlib.generate( user, "1234", new Date().getTime() + 15 * 60 * 1000 ),
			successRe = /^success=(([^:]*):([^:]*):([^:]*))$/;
		async.waterfall( [

			function ( cb ) {
				r.get( path ).set( authHeader, token ).expect( 200 ).expect( authHeader, successRe ).expect( userHeader, userInfo, cb );
			},
			function ( res, cb ) {
				var match = res.headers[ authHeader ].match( successRe );
				r.get( path ).set( authHeader, match[ 1 ] ).expect( 200 ).expect( authHeader, successRe ).expect( userHeader, userInfo, cb );
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
} );