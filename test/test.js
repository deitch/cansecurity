/*jslint nomen:true, node:true */
/*global exports*/

var tests = [], tmp = {}, _ = require('underscore'), exec = require('child_process').exec,
nodeunit = require('nodeunit'), fs = require('fs'), vm = require('vm'), arg, testFn = {}, 
code, sendResponse, tokenlib = require('../lib/token'), SESSIONKEY = "ABCDEFG", TESTROOT = "./test/",
express = require('express'), cs = require('../lib/index'), cansec, http = require("http"), reporter,
runTests, testRunner, server, PORT = 3020, user, URL = {host: "localhost",port: PORT, path: "/foo"}, send200,
getCheckObject,
sandbox = {testFn: testFn, nodeunit:nodeunit, console:console};

// in case they ever fix it
reporter = nodeunit.reporters["default"];

user = {
		"1":{name:"john",pass:"1234",age:25,id:"1",roles:["admin"]},
		"2":{name:"jill",pass:"1234",age:30,id:"2"},
		"3":{name:"norole",pass:"1234",id:"3"},
		"4":{name:"userrole",pass:"1234",id:"4",roles:["user","regular"]}
		};

sendResponse = function(req,res,status,data) {
	if (data) {
		res.contentType("application/json");
		res.send(data,status);
	} else {
		res.send(status);
	}
};

sandbox.doHttp = function(test,config) {
	var opts = {}, req, header = config.header || {}, tmp;
	config = config || {};
	if (config.username && config.password) {
		_.extend(header,{Authorization:'Basic ' + new Buffer(config.username + ':' + config.password).toString('base64')});
	}
	_.extend(opts,URL,{method:config.method,path:config.path},{headers: header || {}});
	req = http.request(opts,function(res){
		var d = "";
		// make sure the response code was as expected
		test.equal(config.responseCode,res.statusCode,config.msg);
		// check for content of response
		res.on("data",function(chunk){
			d += chunk;
		});
		res.on("end",function(){
			var obj, len, tested = {};
			// did we have expected text?
			if (config.responseText !== undefined) {
				test.equal(config.responseText,d,"expected content to be: "+config.responseText);
			}
			// did we have expected objects?
			if (config.responseJson !== undefined) {
				try {
					obj = JSON.parse(d);
					// go through each item in each, make sure it exists
					_.each(config.responseJson,function(val,key){
						var c1, c2;
						c1 = typeof(obj[key]) === "string" ? obj[key] : JSON.stringify(obj[key]);
						c2 = typeof(val) === "string" ? val : JSON.stringify(val);
						test.equal(c2,c1,"Unmatched value for "+key+" in response object");
						tested[key] = true;
					});
					_.each(obj,function(val,key){
						if (!tested[key]) {
							test.equal(val,config.responseJson[key],"response object has unexpected key "+key);
						}
					});
				} catch (e) {
					test.equal(false,true,"expected response to be JSON parsable");
				}
			}
			
			
			// if there was a callback execute it, else we are done
			if (config.cb && typeof(config.cb) === "function") {
				config.cb(res,d);
			} else {
				test.done();
			}
		});
	});
	if (config.data) {
		req.write(config.data);
	}
	req.end();
};

sandbox.tokenlib = tokenlib;
tokenlib.init(SESSIONKEY);

runTests = function(tests) {
	var file, count = 0;
	_.each(tests,function(elm,i){
		if (elm === "all") {
			// just load all from folder
			_.each(fs.readdirSync(TESTROOT) || [], function(f) {
				file = f;
				/*jslint regexp:false */
				if (file.match(/^test-.*\.js$/)) {
					/*jslint regexp:true */
					code = fs.readFileSync(TESTROOT+file);
					vm.runInNewContext(code,sandbox,TESTROOT+file);
				}
			});
		} else {
			file = TESTROOT+"test-"+elm+".js";
			code = fs.readFileSync(file);
			vm.runInNewContext(code,sandbox,file);
		}
	});

	// one name or all


	// convert to properly named
	_.each(testFn,function(val,key){
		var o = {};
		o[key] = val;
		tests.push(o);
		count++;
	});
	if (count > 0) {
		reporter.run(sandbox.testFn,null,function(){
			server.close();
		});
	} else {
		console.log("No tests to run");
	}
};

// initialize sessionManager
cansec = cs.init({
	getUser: function(login,success,failure){
		var found = null;
		// search for our user
		_.each(user,function(val,key){
			var ret = true;
			if (val.name === login) {
				found = val;
				ret = false;
			}
			return(ret);
		});
		if (found) {
			success(found,found.name,found.pass);
		} else {
			failure();
		}
	},
	validatePassword: function(login,pass,cb){
		var p = null, message = "invaliduser", resuser = null;
		// search for our user
		_.each(user,function(val,key) {
			var ret = true;
			if (val.name === login) {
				ret = false;
				if (val.pass === pass) {
					message = null;
					resuser = val;
					p = pass;
				} else {
					message = "invalidpass";
				}
			}
			return(ret);
		});
		cb(resuser,message,p);
	},
	sessionKey: SESSIONKEY
});

send200 = function(req,res,next){
	// send a 200
	sendResponse(req,res,200);
};
getCheckObject = function(req,res) {
	return({owner:"2",recipient:"4"});
};

// create our express server
server = express.createServer();
server.configure(function(){
	server.use(express.cookieParser());	
	server.use(express.session({secret: "agf67dchkQ!"}));
	server.use(cansec.validate);
	server.use(server.router);
});
server.get("/public",send200);
server.get("/secure/loggedin",cansec.restrictToLoggedIn,send200);
server.get("/secure/user/:user",cansec.restrictToSelf,send200);
server.get("/secure/roles/admin",cansec.restrictToRoles("admin"),send200);
server.get("/secure/roles/adminOrSuper",cansec.restrictToRoles(["admin","super"]),send200);
server.get("/secure/selfOrRoles/:user/admin",cansec.restrictToSelfOrRoles("admin"),send200);
server.get("/secure/selfOrRoles/:user/adminOrSuper",cansec.restrictToSelfOrRoles(["admin","super"]),send200);
server.get("/secure/param",cansec.restrictToParam("searchParam"),send200);
server.get("/secure/paramOrRole",cansec.restrictToParamOrRoles("searchParam","admin"),send200);
server.get("/secure/paramOrMultipleRoles",cansec.restrictToParamOrRoles("searchParam",["admin","super"]),send200);
server.get("/secure/field",cansec.restrictToField("owner",getCheckObject),send200);
server.get("/secure/fields",cansec.restrictToField(["owner","recipient"],getCheckObject),send200);
server.get("/secure/fieldOrRole",cansec.restrictToFieldOrRoles("owner","admin",getCheckObject),send200);
server.get("/secure/fieldOrRoles",cansec.restrictToFieldOrRoles("owner",["admin","super"],getCheckObject),send200);
server.get("/secure/fieldsOrRole",cansec.restrictToFieldOrRoles(["owner","recipient"],"admin",getCheckObject),send200);
server.get("/secure/fieldsOrRoles",cansec.restrictToFieldOrRoles(["owner","recipient"],["admin","super"],getCheckObject),send200);
// conditionals
server.get("/secure/conditionalDirect",cansec.ifParam("private","true").restrictToLoggedIn,send200);
server.get("/secure/conditionalIndirect",cansec.ifParam("private","true").restrictToRoles(["admin","super"]),send200);


server.error(function(err,req,res,next){
	var data;
	if (err && err.status) {
		// one of ours
		data = err.message ? {message: err.message} : null;
		sendResponse(req,res,err.status,data);
	} else if (err && err.type && err.type === "unexpected_token") {
		// malformed data
		sendResponse(req,res,{message:err.type},400);
	} else {
		sendResponse(req,res,500);
	}
	
});
server.listen(PORT);


arg = process.argv.slice(2);
// each argument is either the name of a test, or a keyword to other tests
if (arg.length < 1) {
	arg = ["all"];
}
runTests(arg);

