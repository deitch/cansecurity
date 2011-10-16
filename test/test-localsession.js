/*global nodeunit, userpass, doHttp, testFn, tokenlib */
var authHeader = "X-CS-Auth".toLowerCase();
testFn.localSession = {
	localSession: nodeunit.testCase({
		// get the user foo and show they do not exist
		localSession : function(test) {
			// should return 200
			// should return X-CS-Auth header
			// should be able to extract the session cookie and use it
			// should have no local session
			doHttp(test,{method:"GET",path:"/public",responseCode:200,
					msg:"Should return 200 for initial user/pass setting",
					username:"john",password:"1234",
					cb:function(res,data){
						// get the cookie, play it back
						var cookie = res.headers["set-cookie"][0], header = {};
						cookie = cookie.split(";")[0];
						header.cookie = cookie;
						doHttp(test,{method:"GET",path:"/public",responseCode:200,
							msg: "Should return 200 when using cookie to refer to previous session",
							header:header,
							cb:function(res,data) {
								var match = res.headers[authHeader].match(/^success=/);
								test.strictEqual(match.length,1,"Should have authHeader");
								test.done();
							}
						});
					}});
		}
	})
};

