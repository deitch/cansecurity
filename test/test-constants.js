/*globals describe, it */
var constants = require('../lib/constants'),
	assert = require('assert'),
	AUTHHEADER = 'X-CS-Auth';

describe ("constants", function(){
	it("Initialzation without parameters", function(){
		var c = constants.get();

		assert.equal(c.header.AUTH, AUTHHEADER, "header.AUTH should be "+AUTHHEADER + " but found " +c.header.AUTH);
	});

	it("Initialzation without expected parameters", function(){
		constants.init({
			unexpectedKey1: "unexpectedValue2",
			unexpectedKey2: "unexpectedValue2"
		});
		var c = constants.get();

		assert.equal(c.header.AUTH, AUTHHEADER, "header.AUTH should be "+AUTHHEADER + " but found " +c.header.AUTH);
	});

	it("Initialzation with expected parameters", function(){
		var headers = {
			authHeader: "test-auth-header"
		};
		
		constants.init(headers);
		var c = constants.get();

		assert.equal(c.header.AUTH, headers.authHeader, "header.AUTH should be " + headers.authHeader + " but found " +c.header.AUTH);
	});
});