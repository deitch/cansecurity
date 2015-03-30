/*jslint node:true, unused:vars */
module.exports = function(err,req,res,next){
	var data;
	if (err && err.status) {
		// one of ours
		data = err.message ? {message: err.message} : null;
		res.status(err.status).send(data);
	} else if (err && err.type && err.type === "unexpected_token") {
		// malformed data
		res.status(400).send({message:err.type});
	} else {
		res.status(500).end();
	}
};
