/*jslint node:true */
var sha1 = require('./sha1').sha1, exports = module.exports;

var sessionKey = null;

exports.init = function(sk) {
	sessionKey = sk;
};
exports.generate = function(name,password,expiry) {
	var token;
	token = [name,password,sessionKey,expiry].join(":");
	token = [sha1.hash(token),name,expiry].join(":");
	return(token);
};
exports.validate = function(token,name,password) {
	var p, sec, valid = false, expiry;
	token = token || "";
	p = token.split(":");
	expiry = p[2];
	if (p[1] === name && !isNaN(expiry) && parseInt(expiry,10) > new Date().getTime()) {
		sec = [name,password,sessionKey,expiry].join(":");
		sec = sha1.hash(sec);
		valid = sec === p[0];	
	}
	return(valid);
};
