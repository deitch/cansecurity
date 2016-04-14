var crypto = require('crypto'), exports = module.exports, jwt = require('jsonwebtoken');

var sessionKey = null;
var encryptHeader = false;
// for safety
var warn = function () {
};
var now = require('./util').now;

exports.init = function(key, encrypt) {
	sessionKey = key;
	encryptHeader = encrypt || false;
};
exports.setWarn = function (fn) {
	warn = fn;
};

exports.generate = function(name, user, expiry) {
	var token = jwt.sign({sub:name,exp:expiry,"cs-user":user},sessionKey,{algorithm:"HS256"});

	if(encryptHeader) {
		token = exports.cipher(token);
	}

	return(token);
};

exports.validate = function(token) {
	warn("validating auth token "+token);
	var valid = false, expiry, decoded, t = now();
	token = token || "";
	if (encryptHeader) {
		token = exports.decipher(token);
	}
	try {
		decoded = jwt.verify(token,sessionKey,{algorithms:"HS256"});
		expiry = decoded.exp;
		warn("token expiry "+expiry+" now "+t);
		warn("token name "+decoded.sub);
		if (!isNaN(expiry) && parseInt(expiry,10) > t) {
			valid = decoded;
		} else {
			valid = false;
		}
	} catch (e) {
		valid = false;
	}

	warn("token valid? "+valid);
	return(decoded);
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

