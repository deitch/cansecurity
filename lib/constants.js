var constants = {
	header : {
		USER : 'X-CS-User',
		AUTH: 'X-CS-Auth',
		AUTHMETHOD : 'X-CS-Auth.method',
		AUTHSESSION: 'X-CS-Auth',
		CORS: 'Access-Control-Expose-Headers'
	},
	method: {
		CREDENTIALS :"credentials",
		TOKEN: "token"
	}
};

module.exports = {
	init : function (config) {
		if(!config) return;

		constants.header.AUTH = config.authHeader || constants.header.AUTH;
		constants.header.USER = config.userHeader || constants.header.USER;
	},
	get: function() {
		return constants;
	}
};