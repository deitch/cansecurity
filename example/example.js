/*jshint unused:vars */
var express = require('express'), cs = require('cansecurity'), http = require('http'),
SESSIONKEY = "agf67dchkQ", cors = require('cors'),

// static database for testing
user = require('./user'),

cansec = cs.init({
	validate: function(login,password,callback){
		if (user.name !== login) {
			// no such user - ERROR
			callback(false,null,"invaliduser");
		} else if (password === undefined) {
			// never asked to check a password, just send the user - GOOD
	    callback(true,user,user.name);
		} else if (user.pass !== password) {
			// asked to check password, but it didn't match - ERROR
			callback(false,null,"invalidpass");
		} else {
			// user matches, password matches - GOOD
			callback(true,user,user.name);
		}
	},
	sessionKey: SESSIONKEY
});



module.exports = function () {
	var app = express();
	app.use(cors({credentials:true,exposedHeaders:["Location"],methods:'GET,HEAD,PUT,PATCH,POST,DELETE'}));
	app.use(cansec.validate);
	app.use(function(req,res,next){
		// send a 200
		res.status(200).send("bar");
	});
	app.use(function(err,req,res,next){
		var data;
		if (err && err.status) {
			// one of ours
			data = err.message ? {message: err.message} : null;
			res.send(req,res,err.status,data);
		} else if (err && err.type && err.type === "unexpected_token") {
			// malformed data
			res.send(req,res,{message:err.type},400);
		} else {
			res.send(req,res,500);
		}
	
	});
	return http.createServer(app).listen();
};

