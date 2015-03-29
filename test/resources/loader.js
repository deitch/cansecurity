/*jslint node:true, nomen:true, unused:vars */
module.exports = {
	local: function ( req, res, next ) {
		req.cansecurity.item = "local";
		next();
	}
};