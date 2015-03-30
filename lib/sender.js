/*jslint node:true */
module.exports = function (res,status,body) {
	// are we in express or restify?
	// in express, arity of res.send() is 1 (just body)
	// in restify, arity of res.send() is 3 (code,body,headers)
	var l = res.send.length;
	if (l === 1) {
		res.status(status);
		if (body !== undefined && body !== null) {
			res.send(body);
		} else {
			res.end();
		}
	} else {
		res.send(status,body);
	}
};