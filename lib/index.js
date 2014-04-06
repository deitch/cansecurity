/*jslint node:true */
// get the authentication/sessionManager library and the authorization library
var cansec = require('./sessionManager'),
	auth = require('./authorization'),
	declarative = require('./declarative'),
	constants = require('./constants');
	
module.exports = {
	init: function (config) {
		var authentication, authorization, ret = {}, i, that = this;
		// initialize each part of the library
		constants.init(config);
		authentication = cansec.init(config);
		authorization = auth.init(config);
		declarative.init(config);
		// merge the two into ret object
		// authentication methods
		for (i in authentication) {
			if (authentication.hasOwnProperty(i)) {
				ret[i] = authentication[i];
			}
		}
		// authorization methods
		for (i in authorization) {
			if (authorization.hasOwnProperty(i)) {
				ret[i] = authorization[i];
			}
		}
		// declarative authorization
		that.authorizer = ret.authorizer = declarative.loadFile;
		that.getAuthMethod = ret.getAuthMethod;
		that.getUser = ret.getUser;
		return (ret);
	}
};