/*global nodeunit, userpass, doHttp, testFn, tokenlib */
var authHeader = "X-CS-Auth".toLowerCase(), successRe = /^success=(([^:]*):([^:]*):([^:]*))$/, user = "john", pass = "1234";
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
								var match = res.headers[authHeader].match(successRe);
								test.strictEqual(match.length,5,"Should have authHeader");
								test.done();
							}
						});
					}});
		},
		multipleRequests : function(test) {
			doHttp(test,{method:"GET",path:"/public",responseCode:200,
					msg:"Should return 200 for initial user/pass setting",
					username:user,password:pass,
					cb:function(res,data){
						// get the cookie, play it back, and check the login success header
						var match = res.headers[authHeader].match(successRe), cookie = res.headers["set-cookie"][0], header = {};

						test.strictEqual(match.length,5,"Should have authHeader");
						test.equal(match[3],user,"should return user in second part of token");

						cookie = cookie.split(";")[0];
						header.cookie = cookie;
						doHttp(test,{method:"GET",path:"/public",responseCode:200,
							msg: "Should return 200 when using cookie to refer to previous session",
							header:header,
							cb:function(res,data) {
								var match = res.headers[authHeader].match(successRe);
								test.strictEqual(match.length,5,"Should have authHeader");
								test.equal(match[3],user,"should return user in second part of token");
								test.done();
							}
						});
					}});
		}
	})
};

