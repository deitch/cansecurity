/*jslint node:true, nomen:true, unused:vars */
/*global before, it, describe, after */
var express = require('express'), restify = require('restify'), app, request = require('supertest'),
cansec, cs = require('./resources/cs'), errorHandler = require('./resources/error'), 
cookieParser = require('cookie-parser'),
session = require('express-session'),
declareFile = __dirname+'/resources/declare.json',
declareLocalFile = __dirname+'/resources/declare2.json',
declareLocalLoader = __dirname+'/resources/loader.js',
r, path, send200 = function(req,res,next){
	// send a 200
	require('../lib/sender')(res,200);
},
firsttests = function () {
  it('should allow no path match', function(done){
    r.get("/foo").expect(200,done);
  });
	it('should allow non-declared method', function(done){
		r.post("/foo").type('json').send({a:1}).expect(200,done);
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
},
secondtests = function () {
  it('should deny denyAll if sent without format', function(done){
	  r.get("/secure/denyAll").expect(403,done);
  });
  it('should deny denyAll if sent with format', function(done){
	  r.get("/secure/denyAll.json").expect(403,done);
  });
},
thirdtests = function () {
	describe('loader', function(){
	  it('should return 200 for global loader', function(done){
		  r.get('/secure2/globalloader').expect(200,done);
	  });
		it('should execute the specific group loader instead of the global one', function(done){
		  r.get('/secure2/localloader').expect(200,done);
		});
	});
};


describe('declarative authorization', function(){
	describe('express', function(){
		describe('without format flag', function(){
			before(function(){
				cansec = cs.init();
				app = express();
				app.use(cookieParser());	
				app.use(session({secret: "agf67dchkQ!",resave:false,saveUninitialized:false}));
				app.use(cansec.validate);
				// This is where we instantiate the declarative authorizer
				app.use(cansec.authorizer(declareFile));
				app.use(errorHandler);
		
				// we just send 200 for all routes, if it passes authorization
				app.all('*',send200);
		
				r = request(app);
			});
			firsttests();
		});
		describe('with format flag', function(){
			before(function(){
				cansec = cs.init();
				app = express();
				app.use(cookieParser());	
				app.use(session({secret: "agf67dchkQ!",resave:false,saveUninitialized:false}));
				app.use(cansec.validate);
				// This is where we instantiate the declarative authorizer
				app.use(cansec.authorizer(declareFile,{format:true}));
				app.use(errorHandler);
		
				// we just send 200 for all routes, if it passes authorization
				app.all('*',send200);
		
				r = request(app);
			});
			secondtests();
		});
		describe('multiple declarations', function(){
			before(function(){
				cansec = cs.init();
				app = express();
				app.use(cookieParser());	
				app.use(session({secret: "agf67dchkQ!",resave:false,saveUninitialized:false}));
				app.use(cansec.validate);
				// This is where we instantiate the declarative authorizer
				app.use(cansec.authorizer(declareFile));
				app.use(cansec.authorizer(declareLocalFile,{loader:require(declareLocalLoader)}));
				app.use(errorHandler);
		
				// we just send 200 for all routes, if it passes authorization
				app.all('*',send200);
		
				r = request(app);
			});
			// all of the firsttests should still pass
			firsttests();
			// all of the thirdtests should pass
			thirdtests();
		});
	});
	describe('restify', function(){
		describe('without format flag', function(){
			before(function(){
				cansec = cs.init();
				app = restify.createServer();
				app.use(restify.queryParser());
				app.use(cansec.validate);
				// This is where we instantiate the declarative authorizer
				app.use(cansec.authorizer(declareFile));
				// we just send 200 for all routes, if it passes authorization
				app.get(/^.*$/,send200);
				app.post(/^.*$/,send200);
				app.put(/^.*$/,send200);
				app.del(/^.*$/,send200);
				app.head(/^.*$/,send200);
		
				r = request(app);
			});
			firsttests();
			after(function(){
				app.close();
			});
		});
		describe('with format flag', function(){
			before(function(){
				cansec = cs.init();
				app = restify.createServer();
				app.use(restify.queryParser());
				app.use(cansec.validate);
				// This is where we instantiate the declarative authorizer
				app.use(cansec.authorizer(declareFile,{format:true}));
		
				// we just send 200 for all routes, if it passes authorization
				app.get(/^.*$/,send200);
				app.post(/^.*$/,send200);
				app.put(/^.*$/,send200);
				app.del(/^.*$/,send200);
				app.head(/^.*$/,send200);
		
				r = request(app);
			});
			secondtests();
		});
		describe('multiple declarations', function(){
		});
	});
});
