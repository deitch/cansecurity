/*global module, require, Buffer */

var errors = {
	unauthorized: function(msg){ return {status: 403, message: msg || "unauthorized"};},
	unauthenticated: function(msg){ return {status: 401, message: msg || "unauthenticated"};},
	// 409 is a resource conflict - see RFC2616
	conflict: function(msg){ return {status: 409, message: msg || "conflict"};},
	badRequest: function(msg){ return {status: 400, message: msg || "badrequest"};},
	notFound: function(msg){ return {status: 404, message: msg || "notfound"};},
	server: function(msg) {return {status: 500, message: msg || ""};}
};

module.exports = errors;

