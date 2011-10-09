/*jslint nomen:false, node:true */
/*global exports*/

/*
 * rest api test cases for studymesh
 */
var tests = [], tmp = {}, _ = require('underscore'), exec = require('child_process').exec,
nodeunit = require('nodeunit'), fs = require('fs'), vm = require('vm'), sys = require('sys'), arg, testFn = {}, 
code, sandbox = {testFn: testFn, nodeunit:nodeunit},
runTests, testRunner;

runTests = function(tests) {
	var file;
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
	});
	nodeunit.reporters["default"].run(sandbox.testFn);
};

arg = process.argv.slice(2);

// each argument is either the name of a test, or a keyword to other tests
if (arg.length < 1) {
	arg = ["all"];
}
runTests(arg);

