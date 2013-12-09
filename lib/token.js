/*jslint node:true */
var crypto = require('crypto'), exports = module.exports;

var sessionKey = null;
var encryptHeader = false;

exports.init = function(sk, eh) {
	sessionKey = sk;
	encryptHeader = eh || false;
};
exports.generate = function(name,password,expiry) {
	var token, sha1 = crypto.createHash('sha1');
	token = [name,password,sessionKey,expiry].join(":");
	sha1.update(token);
	token = [sha1.digest('hex'),name,expiry].join(":");
	
	if(encryptHeader) {
		token = exports.cipher(token);
	}

	return(token);
};

exports.cipher = function(token) {
	var cipher = crypto.createCipher('rc4-hmac-md5', sessionKey);
	token = cipher.update(token, 'utf8','base64');
	token += cipher.final('base64');
	return token;
};

exports.decipher = function(token){
	var decipher = crypto.createDecipher('rc4-hmac-md5', sessionKey);
	token = decipher.update(token, 'base64','utf8');
	token += decipher.final('utf8');
	return token;
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
