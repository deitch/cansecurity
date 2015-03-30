/*jslint node:true */
module.exports = function (req) {
	req.param = function(name, defaultValue){
		var params = this.params || {}, body = this.body || {}, query = this.query || {},
		ret = defaultValue;
		if (params[name] !== null && params[name] !== undefined && params.hasOwnProperty(name)) {
			ret = params[name];
		} else if (body[name] !== null && body[name] !== undefined) {
			ret = body[name];
		} else if (query[name] !== null && query[name] !== undefined) {
			ret = query[name];
		}
		return ret;
	};
};