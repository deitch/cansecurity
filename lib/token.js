/*jslint node:true */
var crypto = require('crypto'), exports = module.exports;

var sessionKey = null;

exports.init = function(sk) {
	sessionKey = sk;
};
exports.generate = function(name,password,expiry) {
	var token, sha1 = crypto.createHash('sha1');
	token = [name,password,sessionKey,expiry].join(":");
	sha1.update(token);
	token = [sha1.digest('hex'),name,expiry].join(":");
	return(token);
};
exports.validate = function(token,name,password) {
	var p, sec, valid = false, expiry, sha1 = crypto.createHash('sha1');
	token = token || "";
	p = token.split(":");
	expiry = p[2];
	if (p[1] === name && !isNaN(expiry) && parseInt(expiry,10) > new Date().getTime()) {
		sec = [name,password,sessionKey,expiry].join(":");
		sha1.update(sec);
		sec = sha1.digest('hex');
		valid = sec === p[0];	
	}
	return(valid);
};
