/*global module, require, Buffer */

var tokenlib = require('./token'), session, getUser, that, sessionManager, validatePass, getAuthCredentials,
errors = require('./errors');

var AUTHCOOKIE = "authtoken", USERCOOKIE = "userInfo", AUTHHEADER = "X-CS-Auth", AUTHSESSION = AUTHHEADER,
SESSIONEXPIRY = 15, // minutes
sessionExpiry, hasInit = false,
CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split(""),
genRandomString;

/*jslint regexp:false */
var MSGRE = /^error=(.+)$/;
/*jslint regexp:true */

/*
 * generate a pseudo-random session key of length "length"
 * Not *very* random, should not rely on it too heavily
 */
genRandomString = function(length) {
	var c = CHARS.length, ret = [],i;
	for (i=0;i<length;i++) {
		ret.push(CHARS[Math.floor(Math.random()*c)]);
	}
	return(ret.join(""));
};

session = function(config) {
	var req = config.req, res = config.res, expiry = new Date().getTime() + sessionExpiry;
	if (config.user) {
		if (req.session) {
			req.session[AUTHSESSION] = {
				user: config.user,
				login: config.login,
				expiry: expiry
			};
			req.session.touch();
		}
		req[AUTHHEADER] = config.user;
		res.header(AUTHHEADER,"success="+tokenlib.generate(config.login,config.password, expiry));
	} else {
		if (req.session) {
			delete req.session[AUTHSESSION];
		}
		if (config.message) {
			res.header(AUTHHEADER,"error="+config.message);
		}
		// no need to set the authheader; it should automatically not be set, unlike cookies, which reset unles you tell them to clear
	}
};

/*
 * Get the authentication credentials from the request
 */
getAuthCredentials = function(req) {
	var ret = null, header, user, pass;
	if (req.headers.authorization && req.headers.authorization.indexOf("Basic ") === 0) {
		header = new Buffer(req.headers.authorization.split(' ')[1], 'base64').toString().split(":");
		if (header && header.length === 2) {
			ret = {
				user: header[0],
				password: header[1]
			};
		}
	}
	return(ret);
};

that = {
	// if there is a login session token, refresh its timeout on each request, and validate it
	validate : function(req,res,next) {
		var token, sessionUser, auth, p, type, manager = this, login, creds, sessionAuth, expiry;
		
		// get the user session
		if (req.session) {
			sessionAuth = req.session[AUTHSESSION];
			if (sessionAuth) {
				sessionUser = sessionAuth.user;
			}
		}
		// get the authentication header
		auth = req.headers[AUTHHEADER] || req.headers[AUTHHEADER.toLowerCase()];
		//token = req.cookies[AUTHCOOKIE];
		// see if we have the user in our session cache
		
		// first, we see if there are authentication credentials passed
		// then we look for a saved cs session
		// then we look for a local session
		// last, we indicate we have nothing
		creds = getAuthCredentials(req);
		if (creds) {
			if (validatePass && typeof(validatePass) === "function") {
				validatePass(creds.user,creds.password,function(user,message,pass) {
					if (user) {
						session({req: req, res: res, user: user, login: creds.user, password: pass});
						next();
					} else {
						// clear the session, pass the 401 bad credentials
						session({req: req, res: res, message: message});
						next(errors.unauthenticated());
					}
				});
			}
		} else if (auth) {
			p = auth.split(":");
			if (getUser && typeof(getUser) === "function") {
				getUser(p[1],function(user,login,password){
					if (tokenlib.validate(auth,login,password)) {
						session({req:req,res:res,user:user,login:login,password:password});
					} else {
						session({req:req,res:res,message:"invalidtoken"});
					}
					next();
				},function(){
					session({req:req,res:res,message:"invalidtoken"});
					next();
				});
			}
		} else if (sessionUser){
			// is it still valid?
			expiry = sessionAuth.expiry;
			if (expiry > new Date().getTime()) {
				session({req:req,res:res,user:sessionUser});
				next();
			}
		} else {
			session({req:req,res:res});
			next();
		}
	},
	clear : function(req,res) {
		session({req:req,res:res});
	},
	message: function(res) {
		var msg, p = res.headers[AUTHHEADER] || res.headers[AUTHHEADER.toLowerCase()] || "", match = MSGRE.exec(p);
		msg = match && match.length > 1 && match[1].length > 0 ? match[1] : "";
		return(msg);
	}
};

module.exports = {
	init: function(config) {
		getUser = config.getUser;
		validatePass = config.validatePassword;
		sessionExpiry = (config.expiry || SESSIONEXPIRY)*60*1000;
		tokenlib.init(config.sessionKey || genRandomString(64));
		hasInit = true;
		return that;
	}
};

