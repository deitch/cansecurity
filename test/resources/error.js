/*jslint node:true */
module.exports = function(err,req,res,next){
	var data;
	if (err && err.status) {
		// one of ours
		data = err.message ? {message: err.message} : null;
		res.send(err.status,data);
	} else if (err && err.type && err.type === "unexpected_token") {
		// malformed data
		res.send(400,{message:err.type});
	} else {
		res.send(500);
	}
};
