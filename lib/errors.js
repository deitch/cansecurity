/*global module, require, Buffer */

module.exports = {
  unauthorized: (msg) => msg || "unauthorized",
  unauthenticated: (msg) => msg || "unauthenticated",
  invalidtoken: (msg) => msg || "invalidtoken",
	// 409 is a resource conflict - see RFC2616
  conflict: (msg) => msg || "conflict",
  badRequest: (msg) => msg || "badrequest",
  notFound: (msg) => msg || "notfound",
  uninitialized: (msg) => msg || "uninitialized",
  server: (msg) => msg || ""
};
