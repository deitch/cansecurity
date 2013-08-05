/*jslint node:true, nomen:true */
/*global before, it, describe */
var express = require('express'), app = express(), request = require('supertest'), _ = require('lodash'), 
cansec = require('./resources/cs'), errorHandler = require('./resources/error'), declareFile = __dirname+'/resources/declare.json',
r, path, q, unauthenticated = {message:"unauthenticated"}, unauthorized = {message:"unauthorized"},
send200 = function(req,res,next){
	// send a 200
	res.send(200);
},
getCheckObject = function(req,res) {
	return({owner:"2",recipient:"4"});
};


describe('declarative authorization', function(){
	before(function(){
		app = express();
		app.use(express.cookieParser());	
		app.use(express.session({secret: "agf67dchkQ!"}));
		app.use(cansec.validate);
		// This is where we instantiate the declarative authorizer
		app.use(cansec.authorizer(app,declareFile));
		app.use(app.router);
		app.use(errorHandler);
		
		// we just send 200 for all routes, if it passes authorization
		app.all('*',send200);
		
		r = request(app);
	});
	
  it('should allow no path match', function(done){
    r.get("/foo").expect(200,done);
  });
	describe('deny vs allow', function(){
		it('should always deny denyAll', function(done){
		  r.get("/secure/denyAll").expect(403,done);
		});
		it('should always allow allowAll', function(done){
		  r.get("/secure/allowAll").expect(200,done);
		});
		it('should allow when deny default but rule matched', function(done){
		  r.get('/secure/deny').query({abc:'abc'}).expect(200,done);
		});
		it('should deny when deny default but rule unmatched', function(done){
		  r.get('/secure/deny').expect(403,done);
		});
		it('should allow when allow default but rule unmatched', function(done){
		  r.get('/secure/allow').expect(200,done);		  
		});
		it('should deny when allow default but rule unmatched', function(done){
		  r.get('/secure/allow').query({abc:'abc'}).expect(403,done);
		});
	});
	describe('errors as rule unmatched', function(){
	  it('should deny when default deny has error', function(done){
	    r.get('/secure/denyError').expect(403,done);
	  });
	  it('should allow when default allow has error', function(done){
	    r.get('/secure/allowError').expect(200,done);
	  });
	});
	describe('parameter', function(){
	  it('should ignore rule if parameter is not set', function(done){
	    r.get('/secure/parameter').expect(200,done);
	  });
		it('should implement rule if parameter is set', function(done){
		  r.get('/secure/parameter').query({"private":"true"}).expect(403,done);
		});
	});
	describe('chained parameter', function(){
	  it('should implement rule if parameter is set', function(done){
	    r.get('/secure/chainedParameter').query({"private":true}).expect(403,done);
	  });
		it('should ignore rule if parameter is not set but implement second rule', function(done){
		  r.get('/secure/chainedParameter').expect(403,done);
		});
		it('should pass second rule if parameter is not set but has correct data for second rule', function(done){
		  r.get('/secure/chainedParameter').query({abc:'abc'}).expect(200,done);
		});
	});
});
