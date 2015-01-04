/*jslint node:true, unused:vars */
/*global before,it,describe,after */
var express = require( 'express' ),
	restify = require( 'restify'),
	app,
	cansec,
	cs = require( './resources/cs' ),
	errorHandler = require( './resources/error' ),
	request = require( 'supertest' ),
	r,
	authHeader = "X-CS-Auth".toLowerCase(),
	path = "/public",

alltests = function () {
	it( 'should have no authHeader with no credentials', function ( done ) {
		r.get( path ).expect( 200, function ( err, res ) {
			if ( res.authHeader !== undefined ) {
				done( "authHeader should be undefined" );
			} else {
				done();
			}
		} );
	} );
	it( 'should have error header for bad credentials', function ( done ) {
		r.get( path ).auth( "john", "ABCD" ).expect( 401 ).expect( authHeader, "error=invalidpass", done );
	} );
	it( 'should have correct header for good credentials', function ( done ) {
		var re = /^success=/;
		r.get( path ).auth( "john", "1234" ).expect( 200 ).expect( authHeader, re, done );
	} );		
};
describe( 'userpass', function () {
	before(function(){
		cansec = cs.init();		
	});
	describe('express', function(){
		before( function () {
			app = express();
			app.use( express.cookieParser() );
			app.use( express.session( {
				secret: "agf67dchkQ!"
			} ) );
			app.use( cansec.validate );
			app.use( app.router );
			app.use( errorHandler );
			app.get( '/public', function ( req, res, next ) {
				res.send( 200 );
			} );
			r = request( app );
		} );
		alltests();
	});
	describe('restify', function(){
		before( function () {
			app = restify.createServer();
			app.use( cansec.validate );
			app.get( '/public', function ( req, res, next ) {
				res.send( 200 );
			} );
			r = request( app );
		});
		after(function(){
			app.close();
		});
		alltests();
	});
});