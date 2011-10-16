/*jslint node:true */

// get the authentication/sessionManager library and the authorization library
var cansec = require('./sessionManager'), auth = require('./authorization');

module.exports = {
	init: function(config) {
		var authentication, authorization, ret = {}, i;
		// initialize each part of the library
		authentication = cansec.init(config);
		authorization = auth.init(config);
		// merge the two into ret object
		for (i in authentication) {
			if (authentication.hasOwnProperty(i)) {
				ret[i] = authentication[i];
			}
		}
		for (i in authorization) {
			if (authorization.hasOwnProperty(i)) {
				ret[i] = authorization[i];
			}
		}
		return(ret);
	}
};
