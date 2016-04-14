/*global before */
/*jslint debug:true */

// call the debugger in case we are in debug mode
before(function (done) {
	debugger;
	done();
});
