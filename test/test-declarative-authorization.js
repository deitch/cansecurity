/*jslint node:true, nomen:true */
/*global before, it, describe */
var express = require('express'), app, request = require('supertest'), _ = require('lodash'), 
cansec, cs = require('./resources/cs'), errorHandler = require('./resources/error'), declareFile = __dirname+'/resources/declare.json',
r, path, q, unauthenticated = {message:"unauthenticated"}, unauthorized = {message:"unauthorized"},
send200 = function(req,res,next){
	// send a 200
	res.send(200);
},
getCheckObject = function(req,res) {
	return({owner:"2",recipient:"4"});
};


describe('declarative authorization', function(){
	describe('without format flag', function(){
		before(function(){
			cansec = cs.init();
			app = express();
			app.use(express.cookieParser());	
			app.use(express.session({secret: "agf67dchkQ!"}));
			app.use(cansec.validate);
			// This is where we instantiate the declarative authorizer
			app.use(cansec.authorizer(declareFile));
			app.use(app.router);
			app.use(errorHandler);
		
			// we just send 200 for all routes, if it passes authorization
			app.all('*',send200);
		
			r = request(app);
		});
	
	  it('should allow no path match', function(done){
	    r.get("/foo").expect(200,done);
	  });
		describe('user in condition', function(){
		  it('should deny if user is not logged in', function(done){
		    r.get('/secure/loggedIn').expect(403,done);
		  });
		  it('should allow if user is logged in', function(done){
		    r.get('/secure/loggedIn').auth("john","1234").expect(200,done);
		  });
		});
		describe('dash in condition', function(){
		  it('should accept condition with dash', function(done){
		    r.get('/secure/dash').expect(200,done);
		  });
		});
		describe('request as alias to req', function(){
		  it('should accept condition with "request" in it', function(done){
		    r.get('/secure/request').expect(200,done);
		  });
		});
		describe('basic deny', function(){
			it('should always deny denyAll', function(done){
			  r.get("/secure/denyAll").expect(403,done);
			});
			it('should allow denyAll if format appended', function(done){
			  r.get("/secure/denyAll.json").expect(200,done);
			});
			it('should allow when deny default but rule matched', function(done){
			  r.get('/secure/deny').query({abc:'abc'}).expect(200,done);
			});
			it('should deny when deny default but rule unmatched', function(done){
			  r.get('/secure/deny').expect(403,done);
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
			it('should implement rule if parameter is set even if pass first rule', function(done){
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
			it('should require all rules to pass when parameters exist', function(done){
		    r.get('/secure/chainedParameter').query({"private":true,"abc":"abc"}).expect(403,done);
			});
		});
		describe('path parameter', function(){
		  it('should deny the route if param not matched', function(done){
		    r.get('/secure/user/10').expect(403,done);
		  });
		  it('should allow the route if param is matched', function(done){
		    r.get('/secure/user/1').expect(200,done);
		  });
		});
		describe('login required', function(){
			describe('with only login option', function(){
				before(function(){
				  path = '/secure/login';
				});
			  it('should send 401 when not logged in', function(done){
			    r.get(path).expect(401,done);
			  });
			  it('should send 401 when logged in with wrong password', function(done){
			    r.get(path).auth("john","nopass").expect(401,done);
			  });
				it('should send 403 when logged in but no param', function(done){
				  r.get(path).auth("john","1234").expect(403,done);
				});
				it('should send 403 when logged in with wrong param', function(done){
				  r.get(path).auth("john","1234").query({abc:"cba"}).expect(403,done);
				});
				it('should send 200 when logged in with correct param', function(done){
				  r.get(path).auth("john","1234").query({abc:"abc"}).expect(200,done);
				});
			});
			describe('with login and param option', function(){
				before(function(){
				  path = '/secure/loginParam';
				});
			  it('should send 401 when not logged in', function(done){
			    r.get(path).query({"private":"true"}).expect(401,done);
			  });
			  it('should send 401 when logged in with wrong password', function(done){
			    r.get(path).auth("john","nopass").query({"private":"true"}).expect(401,done);
			  });
				it('should send 403 when logged in but no param', function(done){
				  r.get(path).auth("john","1234").query({"private":"true"}).expect(403,done);
				});
				it('should send 403 when logged in with wrong param', function(done){
				  r.get(path).auth("john","1234").query({"private":"true","abc":"cba"}).expect(403,done);
				});
				it('should send 200 when logged in with correct param', function(done){
				  r.get(path).auth("john","1234").query({"private":"true","abc":"abc"}).expect(200,done);
				});
			});
		});
		describe('loader', function(){
		  it('should return 500 for missing loader', function(done){
			  r.get('/secure/badLoader').expect(500,done);
		  });
		  it('should return 200 for good loader', function(done){
			  r.get('/secure/loader').expect(200,done);
		  });
		});
	});
	describe('with format flag', function(){
		before(function(){
			cansec = cs.init();
			app = express();
			app.use(express.cookieParser());	
			app.use(express.session({secret: "agf67dchkQ!"}));
			app.use(cansec.validate);
			// This is where we instantiate the declarative authorizer
			app.use(cansec.authorizer(declareFile,{format:true}));
			app.use(app.router);
			app.use(errorHandler);
		
			// we just send 200 for all routes, if it passes authorization
			app.all('*',send200);
		
			r = request(app);
		});
	  it('should deny denyAll if sent without format', function(done){
		  r.get("/secure/denyAll").expect(403,done);
	  });
	  it('should deny denyAll if sent with format', function(done){
		  r.get("/secure/denyAll.json").expect(403,done);
	  });
	});
});
