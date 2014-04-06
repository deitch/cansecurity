/*jslint node:true, nomen:true */
/*global before, it, describe */
var express = require('express'), app = express(), request = require('supertest'), _ = require('lodash'), 
cansec, cs = require('./resources/cs'), errorHandler = require('./resources/error'),
r, path, q, unauthenticated = "unauthenticated", unauthorized = "unauthorized",
send200 = function(req,res,next){
	// send a 200
	res.send(200);
},
getCheckObject = function(req,res) {
	return({owner:"2",recipient:"4"});
};


describe('authorization', function(){
	before(function(){
		cansec = cs.init();
		app = express();
		app.use(express.cookieParser());	
		app.use(express.session({secret: "agf67dchkQ!"}));
		app.use(cansec.validate);
		app.use(app.router);
		app.use(errorHandler);
		
		app.get('/secure/fieldOrRole',cansec.restrictToFieldOrRoles("owner","admin",getCheckObject),send200);
		app.get("/secure/loggedin",cansec.restrictToLoggedIn,send200);
		app.get("/secure/user/:user",cansec.restrictToSelf,send200);
		app.get("/secure/roles/admin",cansec.restrictToRoles("admin"),send200);
		app.get("/secure/roles/adminOrSuper",cansec.restrictToRoles(["admin","super"]),send200);
		app.get("/secure/selfOrRoles/:user/admin",cansec.restrictToSelfOrRoles("admin"),send200);
		app.get("/secure/selfOrRoles/:user/adminOrSuper",cansec.restrictToSelfOrRoles(["admin","super"]),send200);
		app.get("/secure/param",cansec.restrictToParam("searchParam"),send200);
		app.get("/secure/paramOrRole",cansec.restrictToParamOrRoles("searchParam","admin"),send200);
		app.get("/secure/paramOrMultipleRoles",cansec.restrictToParamOrRoles("searchParam",["admin","super"]),send200);
		app.get("/secure/field",cansec.restrictToField("owner",getCheckObject),send200);
		app.get("/secure/fields",cansec.restrictToField(["owner","recipient"],getCheckObject),send200);
		app.get("/secure/fieldOrRole",cansec.restrictToFieldOrRoles("owner","admin",getCheckObject),send200);
		app.get("/secure/fieldOrRoles",cansec.restrictToFieldOrRoles("owner",["admin","super"],getCheckObject),send200);
		app.get("/secure/fieldsOrRole",cansec.restrictToFieldOrRoles(["owner","recipient"],"admin",getCheckObject),send200);
		app.get("/secure/fieldsOrRoles",cansec.restrictToFieldOrRoles(["owner","recipient"],["admin","super"],getCheckObject),send200);
		// conditionals
		app.get("/secure/conditionalDirect",cansec.ifParam("private","true").restrictToLoggedIn,send200);
		app.get("/secure/conditionalIndirect",cansec.ifParam("private","true").restrictToRoles(["admin","super"]),send200);
		
		r = request(app);
	});
  describe('logged in path', function(){
		before(function(){
		  path = '/secure/loggedin';
		});
		it('should reject when not logged in',function (done) {
			r.get(path).expect(401,unauthenticated,done);
		});
		it('should accept when logged in', function(done){
			r.get(path).auth('john','1234').expect(200,done);
		});
  });
	describe('self path', function(){
		before(function(){
		  path = '/secure/user/1';
		});
	  it('should reject when not logged in', function(done){
	    r.get(path).expect(401,unauthenticated,done);
	  });
		it('should reject incorrect user', function(done){
		  r.get(path).auth("jill","1234").expect(403,unauthorized,done);
		});
		it('should accept correct user', function(done){
		  r.get(path).auth('john','1234').expect(200,done);
		});
	});
	describe('roles', function(){
		describe('single role required', function(){
			before(function(){
			  path = '/secure/roles/admin';
			});
			it('should reject not logged in', function(done){
			  r.get(path).expect(401,unauthenticated,done);
			});
			it('should reject user with no roles', function(done){
			  r.get(path).auth('norole','1234').expect(403,unauthorized,done);
			});
			it('should reject user with incorrect role', function(done){
			  r.get(path).auth('userrole','1234').expect(403,unauthorized,done);
			});
			it('should accept user with correct role', function(done){
			  r.get(path).auth('john','1234').expect(200,done);
			});
		});
		describe('one of multiple roles required', function(){
			before(function(){
			  path = '/secure/roles/adminOrSuper';
			});
		  it('should reject user with no roles', function(done){
		    r.get(path).auth('norole','1234').expect(403,unauthorized,done);
		  });
		  it('should reject user with no roles', function(done){
		    r.get(path).auth('norole','1234').expect(403,unauthorized,done);
		  });
		  it('should reject user with wrong roles', function(done){
		    r.get(path).auth('userrole','1234').expect(403,unauthorized,done);
		  });
		  it('should accept user with correct roles', function(done){
		    r.get(path).auth('john','1234').expect(200,done);
		  });
		});
	});
	describe('self or roles', function(){
		describe('single role', function(){
			before(function () {
				path = "/secure/selfOrRoles/2/admin";
			});
			it('should reject not logged in', function(done){
			  r.get(path).expect(401,done);
			});
			it('should reject user', function(done){
			  r.get(path).auth('userrole','1234').expect(403,done);
			});
			it('should accept user with admin role', function(done){
			  r.get(path).auth('john','1234').expect(200,done);
			});
		});
		describe('multiple roles', function(){
		  before(function(){
		    path = "/secure/selfOrRoles/2/adminOrSuper";
		  });
			it('should reject user with wrong roles', function(done){
			  r.get(path).auth('userrole','1234').expect(403,unauthorized,done);
			});
			it('should accept user with super role', function(done){
			  r.get(path).auth('jill','1234').expect(200,done);
			});
			it('should accept user with admin role', function(done){
			  r.get(path).auth('john','1234').expect(200,done);
			});
		});
	});
	describe('param', function(){
		before(function(){
		  path = '/secure/param';
			q = {searchParam:"2"};
		});
		it('should reject user not logged in', function(done){
		  r.get(path).query(q).expect(401,unauthenticated,done);
		});
		it('should reject wrong user', function(done){
		  r.get(path).query(q).auth("userrole","1234").expect(403,unauthorized,done);
		});
		it('should accept correct user', function(done){
		  r.get(path).query(q).auth("jill","1234").expect(200,done);
		});
	});
	describe('param or roles', function(){
	  describe('single role', function(){
	    before(function(){
	      path = '/secure/paramOrRole';
				q = {searchParam:2};
	    });
			it('should reject not logged in', function(done){
			  r.get(path).query(q).expect(401,unauthenticated,done);
			});
			it('should reject wrong user', function(done){
			  r.get(path).query(q).auth("userrole","1234").expect(403,unauthorized,done);
			});
			it('should accept user who passes "self"', function(done){
			  r.get(path).query(q).auth("jill","1234").expect(200,done);
			});
			it('should accept user who passes "role"', function(done){
			  r.get(path).query(q).auth("john","1234").expect(200,done);
			});
	  });
	  describe('multiple role', function(){
	    before(function(){
	      path = '/secure/paramOrMultipleRoles';
				q = {searchParam:2};
	    });
			it('should reject not logged in', function(done){
			  r.get(path).query(q).expect(401,unauthenticated,done);
			});
			it('should reject wrong user', function(done){
			  r.get(path).query(q).auth("userrole","1234").expect(403,unauthorized,done);
			});
			it('should accept user who passes "self"', function(done){
			  r.get(path).query(q).auth("jill","1234").expect(200,done);
			});
			it('should accept user who passes "role"', function(done){
			  r.get(path).query(q).auth("john","1234").expect(200,done);
			});
	  });
	});
	describe('field', function(){
	  before(function(){
	    path = '/secure/field';
	  });
		it('should reject not logged in', function(done){
		  r.get(path).expect(401,unauthenticated,done);
		});
		it('should reject wrong user', function(done){
		  r.get(path).auth('userrole','1234').expect(403,unauthorized,done);
		});
		it('should accept correct user', function(done){
		  r.get(path).auth('jill','1234').expect(200,done);
		});
		it('should reject wrong user with admin rights', function(done){
		  r.get(path).auth('john','1234').expect(403,unauthorized,done);
		});
	});
	describe('fields', function(){
	  before(function(){
	    path = '/secure/fields';
	  });
		it('should reject not logged in', function(done){
		  r.get(path).expect(401,unauthenticated,done);
		});
		it('should reject wrong user', function(done){
		  r.get(path).auth('norole','1234').expect(403,unauthorized,done);
		});
		it('should accept correct user as owner', function(done){
		  r.get(path).auth('jill','1234').expect(200,done);
		});
		it('should accept correct user as recipient', function(done){
		  r.get(path).auth('userrole','1234').expect(200,done);
		});
		it('should reject wrong user even if admin', function(done){
		  r.get(path).auth('john','1234').expect(403,unauthorized,done);
		});
	});
	describe('fieldOrRole', function(){
	  before(function(){
	    path = '/secure/fieldOrRole';
	  });
		it('should reject not logged in', function(done){
		  r.get(path).expect(401,unauthenticated,done);
		});
		it('should reject wrong user', function(done){
		  r.get(path).auth('norole','1234').expect(403,unauthorized,done);
		});
		it('should accept owner user', function(done){
		  r.get(path).auth('jill','1234').expect(200,done);
		});
		it('should reject recipient', function(done){
		  r.get(path).auth('userrole','1234').expect(403,unauthorized,done);
		});
		it('should accept admin', function(done){
		  r.get(path).auth('john','1234').expect(200,done);
		});
	});
	describe('fieldOrRoles', function(){
	  before(function(){
	    path = '/secure/fieldOrRoles';
	  });
		it('should reject not logged in', function(done){
		  r.get(path).expect(401,unauthenticated,done);
		});
		it('should reject wrong user', function(done){
		  r.get(path).auth('norole','1234').expect(403,unauthorized,done);
		});
		it('should accept owner', function(done){
		  r.get(path).auth('jill','1234').expect(200,done);
		});
		it('should reject recipient', function(done){
		  r.get(path).auth('userrole','1234').expect(403,unauthorized,done);
		});
		it('should accept admin rights user', function(done){
		  r.get(path).auth('john','1234').expect(200,done);
		});
	});
	describe('fieldsOrRole', function(){
	  before(function(){
	    path = "/secure/fieldsOrRole";
	  });
		it('should reject not logged in', function(done){
		  r.get(path).expect(401,unauthenticated,done);
		});
		it('should reject wrong user', function(done){
		  r.get(path).auth('norole','1234').expect(403,unauthorized,done);
		});
		it('should accept owner', function(done){
		  r.get(path).auth('jill','1234').expect(200,done);
		});
		it('should accept recipient', function(done){
		  r.get(path).auth('userrole','1234').expect(200,done);
		});
		it('should accept admin user',function (done) {
			r.get(path).auth('john','1234').expect(200,done);
		});
	});
	describe('fieldsOrRoles', function(){
	  before(function(){
	    path = "/secure/fieldsOrRoles";
	  });
		it('should reject not logged in', function(done){
		  r.get(path).expect(401,unauthenticated,done);
		});
		it('should reject wrong user', function(done){
		  r.get(path).auth('norole','1234').expect(403,unauthorized,done);
		});
		it('should accept owner', function(done){
		  r.get(path).auth('jill','1234').expect(200,done);
		});
		it('should accept recipient', function(done){
		  r.get(path).auth('userrole','1234').expect(200,done);
		});
		it('should accept admin user', function(done){
		  r.get(path).auth('john','1234').expect(200,done);
		});
	});
	describe('conditionals', function(){
	  describe('direct', function(){
	    before(function(){
	      path = '/secure/conditionalDirect';
				q = {private:true};
	    });
			it('should accept with no parameter', function(done){
			  r.get(path).expect(200,done);
			});
			it('should reject with parameter but not logged in', function(done){
			  r.get(path).query(q).expect(401,unauthenticated,done);
			});
			it('should accept wuth parameter and logged in', function(done){
			  r.get(path).query(q).auth('john','1234').expect(200,done);
			});
	  });
		describe('indirect', function(){
		  before(function(){
		    path = '/secure/conditionalIndirect';
		  });
			it('should accept with no parameter', function(done){
			  r.get(path).expect(200,done);
			});
			it('should reject with parameter but not logged in', function(done){
			  r.get(path).query(q).expect(401,unauthenticated,done);
			});
			it('should accept with parameter and logged in', function(done){
			  r.get(path).query(q).auth('john','1234').expect(200,done);
			});
		});
	});
});


