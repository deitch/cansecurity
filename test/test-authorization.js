/*global nodeunit, userpass, doHttp, testFn, tokenlib */

/*
 * 
server.get("/secure/fieldOrRole",cansec.restrictToFieldOrRoles("owner","admin",getCheckObject),send200);
server.get("/secure/fieldOrRoles",cansec.restrictToFieldOrRoles("owner",["admin","super"],getCheckObject),send200);
server.get("/secure/fieldsOrRole",cansec.restrictToFieldOrRoles(["owner","recipient"],"admin",getCheckObject),send200);
server.get("/secure/fieldsOrRoles",cansec.restrictToFieldOrRoles(["owner","recipient"],["admin","super"],getCheckObject),send200);

 */
testFn.testAuthorization = {
	loggedIn: nodeunit.testCase({
		// not logged in should give unauthenticated
		notLoggedInFail : function(test) {
			// should return 403
			doHttp(test,{method:"GET",path:"/secure/loggedin",responseCode:401,
					responseJson:{message:"unauthenticated"}, msg:"Should return 401"});
		},
		// logged in as any user succeeds
		loggedInSucceed: function(test) {
			// should return 200
			doHttp(test,{method:"GET",path:"/secure/loggedin",responseCode:200,
					username: "john", password:"1234",
					msg:"Should return 200"});
		}
	}),
	self: nodeunit.testCase({
		// not logged in should give unauthenticated
		notLoggedInFail : function(test) {
			// should return 403
			doHttp(test,{method:"GET",path:"/secure/user/1",responseCode:401,
					responseJson:{message:"unauthenticated"}, msg:"Should return 401"});
		},
		// logged in as wrong user should give unauthorized
		incorrectUser: function(test) {
			doHttp(test,{method:"GET",path:"/secure/user/1",responseCode:403,
					username: "jill", password:"1234",responseJson:{message:"unauthorized"},
					msg:"Should return 403"});
		},
		// logged in as right user should give 200
		correctUser: function(test) {
			// should return 200
			doHttp(test,{method:"GET",path:"/secure/user/1",responseCode:200,
					username: "john", password:"1234",
					msg:"Should return 200"});
		}
	}),
	roles: nodeunit.testCase({
		// not logged in should give unauthenticated
		notLoggedInFail : function(test) {
			// should return 403
			doHttp(test,{method:"GET",path:"/secure/roles/admin",responseCode:401,
					responseJson:{message:"unauthenticated"}, msg:"Should return 401"});
		},
		// logged in but no roles at all should give 403
		noRolesSingle : function(test) {
			// should return 403
			doHttp(test,{method:"GET",path:"/secure/roles/admin",responseCode:403,
					username: "norole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		// logged in but incorrect roles should give 403
		wrongRolesSingle : function(test) {
			// should return 403
			doHttp(test,{method:"GET",path:"/secure/roles/admin",responseCode:403,
					username: "userrole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		// correct roles should give 200
		correctRolesSingle : function(test) {
			// should return 200
			doHttp(test,{method:"GET",path:"/secure/roles/admin",responseCode:200,
					username:"john",password:"1234",
					msg:"Should return 200"});
		},
		// logged in but no roles at all should give 403
		noRolesMultiple : function(test) {
			// should return 403
			doHttp(test,{method:"GET",path:"/secure/roles/adminOrSuper",responseCode:403,
					username: "norole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		// logged in but incorrect roles should give 403
		wrongRolesMultiple : function(test) {
			// should return 403
			doHttp(test,{method:"GET",path:"/secure/roles/adminOrSuper",responseCode:403,
					username: "userrole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		// correct roles should give 200
		correctRolesMultiple : function(test) {
			// should return 200
			doHttp(test,{method:"GET",path:"/secure/roles/adminOrSuper",responseCode:200,
					username:"john",password:"1234",
					msg:"Should return 200"});
		}
	}),
	selfOrRoles: nodeunit.testCase({
		// not logged in should give unauthenticated
		notLoggedInFail : function(test) {
			doHttp(test,{method:"GET",path:"/secure/selfOrRoles/2/admin",responseCode:401,
					responseJson:{message:"unauthenticated"}, msg:"Should return 401"});
		},
		loggedInWrongUserNoRolesSingle: function(test) {
			doHttp(test,{method:"GET",path:"/secure/selfOrRoles/2/admin",responseCode:403,
					username: "userrole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		loggedInWrongUserNoRolesMultiple: function(test) {
			doHttp(test,{method:"GET",path:"/secure/selfOrRoles/2/adminOrSuper",responseCode:403,
					username: "userrole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		loggedInCorrectUserNoRolesSingle: function(test) {
			doHttp(test,{method:"GET",path:"/secure/selfOrRoles/2/admin",responseCode:200,
					username: "jill", password: "1234",
					msg:"Should return 200"});
		},
		loggedInCorrectUserNoRolesMultiple: function(test) {
			doHttp(test,{method:"GET",path:"/secure/selfOrRoles/2/adminOrSuper",responseCode:200,
					username: "jill", password: "1234",
					msg:"Should return 200"});
		},
		loggedInWrongUserAdminRolesSingle: function(test) {
			doHttp(test,{method:"GET",path:"/secure/selfOrRoles/2/admin",responseCode:200,
					username: "john", password: "1234",
					msg:"Should return 200"});
		},
		loggedInWrongUserAdminRolesMultiple: function(test) {
			doHttp(test,{method:"GET",path:"/secure/selfOrRoles/2/adminOrSuper",responseCode:200,
					username: "john", password: "1234",
					msg:"Should return 200"});
		}
	}),
	param: nodeunit.testCase({
		// not logged in should give unauthenticated
		notLoggedInFail : function(test) {
			doHttp(test,{method:"GET",path:"/secure/param?searchParam=2",responseCode:401,
					responseJson:{message:"unauthenticated"}, msg:"Should return 401"});
		},
		loggedInWrongUserFail: function(test) {
			doHttp(test,{method:"GET",path:"/secure/param?searchParam=2",responseCode:403,
					username: "userrole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		loggedInCorrectUser: function(test) {
			doHttp(test,{method:"GET",path:"/secure/param?searchParam=2",responseCode:403,
					username: "jill", password: "1234",
					msg:"Should return 200"});
		}
	}),
	paramOrRoles: nodeunit.testCase({
		// not logged in should give unauthenticated
		notLoggedInFail : function(test) {
			doHttp(test,{method:"GET",path:"/secure/paramOrRole?searchParam=2",responseCode:401,
					responseJson:{message:"unauthenticated"}, msg:"Should return 401"});
		},
		loggedInWrongUserWithUserRoleSingle: function(test) {
			doHttp(test,{method:"GET",path:"/secure/paramOrRole?searchParam=2",responseCode:403,
					username: "userrole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		loggedInWrongUserWithUserRoleMultiple: function(test) {
			doHttp(test,{method:"GET",path:"/secure/paramOrMultipleRoles?searchParam=2",responseCode:403,
					username: "userrole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		selfPassSingleRole: function(test) {
			doHttp(test,{method:"GET",path:"/secure/paramOrRole?searchParam=2",responseCode:200,
					username: "jill", password: "1234",
					msg:"Should return 200"});
		},
		selfPassMultipleRole: function(test) {
			doHttp(test,{method:"GET",path:"/secure/paramOrMultipleRoles?searchParam=2",responseCode:200,
					username: "jill", password: "1234",
					msg:"Should return 200"});
		},
		noRoleSingle: function(test) {
			doHttp(test,{method:"GET",path:"/secure/paramOrRole?searchParam=2",responseCode:403,
					username: "userrole", password: "1234",
					responseJson:{message:"unauthorized"},msg:"Should return 403"});
		},
		noRoleMultiple: function(test) {
			doHttp(test,{method:"GET",path:"/secure/paramOrMultipleRoles?searchParam=2",responseCode:403,
					username: "userrole", password: "1234",
					responseJson:{message:"unauthorized"},msg:"Should return 403"});
		},
		adminRoleSingle: function(test) {
			doHttp(test,{method:"GET",path:"/secure/paramOrRole?searchParam=2",responseCode:200,
					username: "john", password: "1234",
					msg:"Should return 200"});
		},
		adminRoleMultiples: function(test) {
			doHttp(test,{method:"GET",path:"/secure/paramOrMultipleRoles?searchParam=2",responseCode:200,
					username: "john", password: "1234",
					msg:"Should return 200"});
		}
	}),
	field: nodeunit.testCase({
		// not logged in should give unauthenticated
		notLoggedInFail : function(test) {
			doHttp(test,{method:"GET",path:"/secure/field",responseCode:401,
					responseJson:{message:"unauthenticated"}, msg:"Should return 401"});
		},
		loggedInWrongUser: function(test) {
			doHttp(test,{method:"GET",path:"/secure/field",responseCode:403,
					username: "userrole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		loggedInCorrectUser: function(test) {
			doHttp(test,{method:"GET",path:"/secure/field",responseCode:200,
					username: "jill", password: "1234",
					msg:"Should return 200"});
		},
		loggedInWrongUserAdminRightsFails: function(test) {
			doHttp(test,{method:"GET",path:"/secure/field",responseCode:403,
					username: "john", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		}
	}),
	fields: nodeunit.testCase({
		// not logged in should give unauthenticated
		notLoggedInFail : function(test) {
			doHttp(test,{method:"GET",path:"/secure/fields",responseCode:401,
					responseJson:{message:"unauthenticated"}, msg:"Should return 401"});
		},
		loggedInWrongUser: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fields",responseCode:403,
					username: "norole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		loggedInCorrectOwner: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fields",responseCode:200,
					username: "jill", password: "1234",
					msg:"Should return 200"});
		},
		loggedInCorrectRecipient: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fields",responseCode:200,
					username: "userrole", password: "1234",
					msg:"Should return 200"});
		},
		loggedInWrongUserAdminRightsFails: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fields",responseCode:403,
					username: "john", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		}
	}),
	fieldOrRole: nodeunit.testCase({
		// not logged in should give unauthenticated
		notLoggedInFail : function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldOrRole",responseCode:401,
					responseJson:{message:"unauthenticated"}, msg:"Should return 401"});
		},
		loggedInWrongUser: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldOrRole",responseCode:403,
					username: "norole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		loggedInCorrectOwner: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldOrRole",responseCode:200,
					username: "jill", password: "1234",
					msg:"Should return 200"});
		},
		loggedInRecipientDisallowed: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldOrRole",responseCode:403,
					username: "userrole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		loggedInAdminRights: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldOrRole",responseCode:200,
					username: "john", password: "1234",
					msg:"Should return 200"});
		}
	}),
	fieldOrRoles: nodeunit.testCase({
		// not logged in should give unauthenticated
		notLoggedInFail : function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldOrRoles",responseCode:401,
					responseJson:{message:"unauthenticated"}, msg:"Should return 401"});
		},
		loggedInWrongUser: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldOrRoles",responseCode:403,
					username: "norole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		loggedInCorrectOwner: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldOrRoles",responseCode:200,
					username: "jill", password: "1234",
					msg:"Should return 200"});
		},
		loggedInRecipientDisallowed: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldOrRoles",responseCode:403,
					username: "userrole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		loggedInAdminRights: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldOrRoles",responseCode:200,
					username: "john", password: "1234",
					msg:"Should return 200"});
		}
	}),
	fieldsOrRole: nodeunit.testCase({
		// not logged in should give unauthenticated
		notLoggedInFail : function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldsOrRole",responseCode:401,
					responseJson:{message:"unauthenticated"}, msg:"Should return 401"});
		},
		loggedInWrongUser: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldsOrRole",responseCode:403,
					username: "norole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		loggedInCorrectOwner: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldsOrRole",responseCode:200,
					username: "jill", password: "1234",
					msg:"Should return 200"});
		},
		loggedInRecipient: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldsOrRole",responseCode:200,
					username: "userrole", password: "1234",
					msg:"Should return 200"});
		},
		loggedInAdminRights: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldsOrRole",responseCode:200,
					username: "john", password: "1234",
					msg:"Should return 200"});
		}
	}),
	fieldsOrRoles: nodeunit.testCase({
		// not logged in should give unauthenticated
		notLoggedInFail : function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldsOrRoles",responseCode:401,
					responseJson:{message:"unauthenticated"}, msg:"Should return 401"});
		},
		loggedInWrongUser: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldsOrRoles",responseCode:403,
					username: "norole", password: "1234",
					responseJson:{message:"unauthorized"}, msg:"Should return 403"});
		},
		loggedInCorrectOwner: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldsOrRoles",responseCode:200,
					username: "jill", password: "1234",
					msg:"Should return 200"});
		},
		loggedInRecipient: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldsOrRoles",responseCode:200,
					username: "userrole", password: "1234",
					msg:"Should return 200"});
		},
		loggedInAdminRights: function(test) {
			doHttp(test,{method:"GET",path:"/secure/fieldsOrRoles",responseCode:200,
					username: "john", password: "1234",
					msg:"Should return 200"});
		}
	})
};

