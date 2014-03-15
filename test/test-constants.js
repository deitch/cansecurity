var constants = require('../lib/constants'),
	assert = require('assert'),
	AUTHHEADER = 'X-CS-Auth',
	USERHEADER = 'X-CS-User';

describe ("constants", function(){
	it("Initialzation without parameters", function(){
		var c = constants.get();

		assert.equal(c.header.AUTH, AUTHHEADER, "header.AUTH should be "+AUTHHEADER + " but found " +c.header.AUTH);
		assert.equal(c.header.USER, USERHEADER, "header.USER should be "+USERHEADER + " but found " +c.header.USER);
	});

	it("Initialzation without expected parameters", function(){
		constants.init({
			unexpectedKey1: "unexpectedValue2",
			unexpectedKey2: "unexpectedValue2"
		});
		var c = constants.get();

		assert.equal(c.header.AUTH, AUTHHEADER, "header.AUTH should be "+AUTHHEADER + " but found " +c.header.AUTH);
		assert.equal(c.header.USER, USERHEADER, "header.USER should be "+USERHEADER + " but found " +c.header.USER);
	});

	it("Initialzation with expected parameters", function(){
		var headers = {
			authHeader: "test-auth-header",
			userHeader: "test-user-header"
		};
		
		constants.init(headers);
		var c = constants.get();

		assert.equal(c.header.AUTH, headers.authHeader, "header.AUTH should be " + headers.authHeader + " but found " +c.header.AUTH);
		assert.equal(c.header.USER, headers.userHeader, "header.USER should be " + headers.userHeader + " but found " +c.header.USER);
	});
});