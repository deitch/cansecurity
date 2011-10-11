/*jslint nomen:false, node:true */
/*global exports*/

/*
 * rest api test cases for studymesh
 */
var tests = [], tmp = {}, _ = require('underscore'), exec = require('child_process').exec,
nodeunit = require('nodeunit'), fs = require('fs'), vm = require('vm'), sys = require('sys'), arg, testFn = {}, 
code, sendResponse, tokenlib = require('../lib/token'), SESSIONKEY = "ABCDEFG",
express = require('express'), cansec = require('../lib/index'), http = require("http"), reporter,
runTests, testRunner, server, PORT = 3020, user, URL = {host: "localhost",port: PORT, path: "/foo"},
sandbox = {testFn: testFn, nodeunit:nodeunit, console:console};

// in case they ever fix it
//reporter = nodeunit.reporters["default"];
reporter = require('./nodeunit-reporter-default-runmodules');

user = {name:"john",pass:"1234",age:25};

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
			_.each(fs.readdirSync("./") || [], function(f) {
				file = f;
				/*jslint regexp:false */
				if (file.match(/^test-.*\.js$/)) {
					/*jslint regexp:true */
					code = fs.readFileSync("./"+file);
					vm.runInNewContext(code,sandbox,file);
				}
			});
		} else {
			file = "./test-"+elm+".js";
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
		reporter.run(sandbox.testFn,{done: function(){
			server.close();
		}});
	} else {
		console.log("No tests to run");
	}
};

// initialize sessionManager
cansec.init({
	getUser: function(login,success,failure){
		if (user.name === login) {
			success(user,user.name,user.pass);
		} else {
			failure();
		}
	},
	validatePassword: function(login,pass,cb){
		var p = null, message, resuser = null;
		if (user.name !== login) {
			message = "invaliduser";
		} else if (user.pass !== pass) {
			message = "invalidpass";
		} else {
			message = null;
			resuser = user;
			p = pass;
		}
		cb(resuser,message,p);
	},
	sessionKey: SESSIONKEY
});


// create our express server
server = express.createServer();
server.configure(function(){
	server.use(express.cookieParser());	
	server.use(express.session({secret: "agf67dchkQ!"}));
	server.use(cansec.validate);
	server.use(function(req,res,next){
		// send a 200
		sendResponse(req,res,200);
	});
});
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

