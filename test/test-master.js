/*global debugger,before,after */
/*jslint debug:true, node:true */

// call the debugger in case we are in debug mode
before(function (done) {
	debugger;
	done();
});
