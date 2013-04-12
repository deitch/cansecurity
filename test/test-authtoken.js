/*global nodeunit, userpass, doHttp, testFn, tokenlib */
var authHeader = "X-CS-Auth".toLowerCase();
testFn.testAuthtoken = {
	authtoken: nodeunit.testCase({
		// get the user foo and show they do not exist
		invalidToken : function(test) {
			// should return 200
			// should return no X-CS-Auth header
			var token = "blahblah", header;
			// should have no local session
			header = {};
			header[authHeader] = token;
			doHttp(test,{method:"GET",path:"/public",responseCode:200,
					header: header,
					msg:"Should return 200",
					cb:function(res,data){
						test.strictEqual(res.headers[authHeader],"error=invalidtoken","Should have invalidtoken message");
						test.done();
					}});
		},
		// get the user foo and show they do not exist
		expiredToken : function(test) {
			// should return 200
			// should return invalidtoken X-CS-Auth header
			// should have no local session
			var token, header;
			// generate expired token
			token = tokenlib.generate("john","1234",new Date().getTime() - (24*60*60*1000));
			header = {};
			header[authHeader] = token;
			doHttp(test,{method:"GET",path:"/public",responseCode:200,
					header:header,
					msg:"Should return 200",
					cb:function(res,data){
						test.strictEqual(res.headers[authHeader],"error=invalidtoken","Should have invalidtoken message");
						test.done();
					}});
		},
		// get the user foo and show they do not exist
		validToken : function(test) {
			// should return 200
			// should return valid X-CS-Auth header
			// should have no local session
			var token, header;
			// generate valid token
			token = tokenlib.generate("john","1234",new Date().getTime() + 15*60*1000);
			header = {};
			header[authHeader] = token;
			doHttp(test,{method:"GET",path:"/public",responseCode:200,
					header:header,
					msg:"Should return 200",
					cb:function(res,data){
						var match = res.headers[authHeader].match(/^success=/);
						test.strictEqual(match.length,1,"Should have authHeader");
						test.done();
					}});
		},
		reuseToken : function(test) {
			var token, header, successRe = /^success=(([^:]*):([^:]*):([^:]*))$/, user = "john";
			// generate valid token
			token = tokenlib.generate(user,"1234",new Date().getTime() + 15*60*1000);
			header = {};
			header[authHeader] = token;
			doHttp(test,{method:"GET",path:"/public",responseCode:200,
					header:header,
					msg:"First connection should return 200",
					cb:function(res,data){
						var match = res.headers[authHeader].match(successRe);
						test.strictEqual(match.length,5,"Should have authHeader");
						test.equal(match[3],user,"should return user in second part of token");
						
						// connect again and reuse token
						header[authHeader] = match[1];
						doHttp(test,{
							method:"GET",path:"/public",responseCode:200,
							header:header,
							msg:"reuse should return 200",
							cb: function(res,data) {
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

