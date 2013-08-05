/*jslint node:true, nomen:true */
var fs = require('fs'), vm = require('vm'), _ = require('lodash');

module.exports = function(app,cfile) {
	var data;
	// source the config file
	/*jslint stupid:true */
	data = fs.readFileSync(cfile,"utf8");
	/*jslint stupid:false */
	data = JSON.parse(data) || {};
	
	// do we have rules?
	_.each(data.routes||[],function (rule) {
		// [verb, url, param, default, condition]
		var verb, url, param = null, def, condition, m = 0;
		rule = rule || [];
		verb = rule[m++].toLowerCase();
		url = rule[m++];
		if (rule.length === 5) {
			param = rule[m++];
		}
		def = rule[m++].toLowerCase();
		condition = rule[m++];
		
		// first go by verb, then url
		app[verb](url,function(req,res,next){
			// so we had a match, next check if we have params
			var useRule = true, isCondition = false, deny = false;
			if (param) {
				useRule = false;
				_.each(param,function (val,key) {
					if (val !== null && val !== undefined && req.param(key) === val) {
						useRule = true;
					}
				});
			}
			if (useRule) {
				// did we match the verb+path+param? Then we need to see if the condition applies
				try {
					isCondition = vm.runInNewContext(condition,{req:req,res:res});
				} catch (e) {
					isCondition = false;
				}
				deny = ((isCondition && def === "allow") || (!isCondition && def === "deny"));
			}
			if (deny) {
				res.send(403);
			} else {
				next();
			}
		});
	});
	
	
	return function(req,res,next) {
		next();
	};
};