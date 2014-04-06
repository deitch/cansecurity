/*global module, require, Buffer */

var errors = {
	unauthorized: function(msg){ return msg || "unauthorized";},
	unauthenticated: function(msg){ return msg || "unauthenticated";},
	invalidtoken: function(msg){ return msg || "invalidtoken";},
	// 409 is a resource conflict - see RFC2616
	conflict: function(msg){ return msg || "conflict";},
	badRequest: function(msg){ return msg || "badrequest";},
	notFound: function(msg){ return msg || "notfound";},
	initialized: function(msg){ return msg || "uninitialized";},
	server: function(msg) {return msg || "";}
};

module.exports = errors;

