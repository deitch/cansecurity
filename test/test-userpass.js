/*global nodeunit, userpass, doHttp, testFn */
var authHeader = "X-CS-Auth".toLowerCase();
testFn.testUserpass = {
	userpass: nodeunit.testCase({
		// get the user foo and show they do not exist
		noCreds : function(test) {
			// should return 200
			// should return no X-CS-Auth header
			// should have no local session
			doHttp(test,{method:"GET",path:"/public",responseCode:200,
					msg:"Should return 200",
					cb:function(res,data){
						test.strictEqual(res.headers[authHeader],undefined,"Should not have authHeader");
						test.done();
					}});
		},
		// get the user foo and show they do not exist
		badCreds : function(test) {
			// should return 200
			// should return no X-CS-Auth header
			// should have no local session
			doHttp(test,{method:"GET",path:"/public",responseCode:401,
					username:"john",password:"ABCD",
					msg:"Should return 401 unauthenticated",
					cb:function(res,data){
						test.strictEqual(res.headers[authHeader],"error=invalidpass","Should have invalidpass authHeader");
						test.done();
					}});
		},
		// get the user foo and show they do not exist
		goodCreds : function(test) {
			// should return 200
			// should return no X-CS-Auth header
			// should have no local session
			doHttp(test,{method:"GET",path:"/public",responseCode:200,
					username:"john",password:"1234",
					msg:"Should return 200",
					cb:function(res,data){
						var match = res.headers[authHeader].match(/^success=/);
						test.strictEqual(match.length,1,"Should have authHeader");
						test.done();
					}});
		}
	})
};

