/*jslint node:true, nomen:true, unused:vars */
/*global before,it,describe,after */
var express = require( 'express' ), restify = require('restify'),
	app,
	cs = require( './resources/cs' ),
	cansec,
	request = require( 'supertest' ),
	cookieParser = require('cookie-parser'),
	session = require('express-session'),
	path = "/public",
	r, async = require( 'async' ),
	authHeader = "X-CS-Auth".toLowerCase(),
	userHeader = "X-CS-User".toLowerCase(),
	userInfo = JSON.stringify( {
		name: "john",
		pass: "1234",
		age: 25,
		id: 1,
		roles: [ "admin" ]
	} ),
	successRe = /^success=(([^:]*):([^:]*):([^:]*))$/,
	user = "john",
	pass = "1234",
	alltests = function () {
		it( 'should work with a local cookie', function ( done ) {
			async.waterfall( [
				function ( cb ) {
					r.get( path ).auth( user, pass ).expect( 200, cb );
				},
				function ( res, cb ) {
					var cookie = res.headers[ "set-cookie" ][ 0 ];
					r.get( path ).set( "cookie", cookie ).expect( 200 ).expect( authHeader, successRe ).expect( userHeader, userInfo, cb );
				}
			], done );
		} );
		it( 'should work with multiple requests', function ( done ) {
			async.waterfall( [
				function ( cb ) {
					r.get( path ).auth( user, pass ).expect( 200 ).expect( authHeader, successRe, cb );
				},
				function ( res, cb ) {
					var match = res.headers[ authHeader ].match( successRe ),
						cookie = res.headers[ "set-cookie" ][ 0 ];
					if (match.length !== 5) {
						cb("Missing authHeader");
					} else if (match[3] !== user) {
						cb("Missing user in authHeader");
					} else {
					cookie = cookie.split( ";" )[ 0 ];
					r.get( path ).set( "cookie", cookie ).expect( 200 ).expect( authHeader, successRe ).expect( userHeader, userInfo, cb );
				}
				},
				function ( res, cb ) {
					var match = res.headers[ authHeader ].match( successRe );
					if (match[3] !== user) {
						cb("Missing user in header");
					} else {
					cb();
				}
				}
			], done );
		} );		
	};
	
describe( 'local session', function () {
	before(function(){
		cansec = cs.init();
	});
	describe('express', function(){
		before( function () {
			app = express();
			app.use( cookieParser() );
			app.use( session( {secret: "agf67dchkQ!",resave:false,saveUninitialized:false} ) );
			app.use( cansec.validate );
			app.get( path, function ( req, res, next ) {
				// send a 200
				require('../lib/sender')(res,200);
			} );
			r = request( app );
		});
		alltests();
	});
	describe('restify', function(){
		before( function () {
			app = restify.createServer();
			app.use( cansec.validate );
			app.get( path, function ( req, res, next ) {
				// send a 200
				require('../lib/sender')(res,200);
			} );
			r = request( app );
		});
		after(function(){
			app.close();
		});
		// restify does not have native sessions
		//alltests();
	});
} );