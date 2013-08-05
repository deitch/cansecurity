/*jslint node:true, nomen:true */
var fs = require('fs'), vm = require('vm'), _ = require('lodash'),
/* 
 * pathRegexp from expressjs https://github.com/visionmedia/express/blob/master/lib/utils.js and modified per our needs
 * expressjs was released under MIT license as of this writing 
 * https://github.com/visionmedia/express/blob/9914a1eb3f7bbe01e3783fa70cb78e02570d7336/LICENSE 
 */
pathRegexp = function(path, sensitive, strict) {
  if (path && path.toString() === '[object RegExp]') {
		return path;
	}
  if (Array.isArray(path)) {
		path = '(' + path.join('|') + ')';
	}
  path = path
    .concat(strict ? '' : '/?')
    .replace(/\/\(/g, '(?:/')
    .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function(_, slash, format, key, capture, optional, star){
      slash = slash || '';
      return String(
        (optional ? '' : slash)
        + '(?:'
        + (optional ? slash : '')
        + (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')'
        + (optional || '')
        + (star ? '(/*)?' : ''));
    })
    .replace(/([\/.])/g, '\\$1')
    .replace(/\*/g, '(.*)');
  return new RegExp('^' + path + '$', sensitive ? '' : 'i');
};

module.exports = function(cfile) {
	var data, routes = {};
	// source the config file
	/*jslint stupid:true */
	data = fs.readFileSync(cfile,"utf8");
	/*jslint stupid:false */
	data = JSON.parse(data) || {};
	
	// do we have rules?
	_.each(data.routes||[],function (rule) {
		// [verb, url, param, default, condition]
		var entry = {}, m = 0, verb;
		rule = rule || [];
		entry.verb = verb = rule[m++].toLowerCase();
		entry.url = rule[m++];
		if (rule.length === 5) {
			entry.param = rule[m++];
		}
		entry.def = rule[m++].toLowerCase();
		entry.condition = rule[m++];
		entry.re = pathRegexp(entry.url);
		routes[verb] = routes[verb] || [];
		routes[verb].push(entry);		
	});
	
	return function(req,res,next) {
		var matched = false, deny = false;
		// first check verb, then check route regexp match, then check params
		_.each(routes[req.method.toLowerCase()],function (entry) {
			var useRule = false, isCondition = false;
			// path match check
			if ((req.path||"").match(entry.re)) {
				useRule = true;
				// next check if we use param - will be false unless no param, or param is match
				if (entry.param) {
					useRule = false;
					_.each(entry.param,function (val,key) {
						if (val !== null && val !== undefined && req.param(key) === val) {
							useRule = true;
						}
					});
				}
				if (useRule) {
					matched = true;
					// did we match the verb+path+param? Then we need to see if the condition applies
					try {
						isCondition = vm.runInNewContext(entry.condition,{req:req,res:res});
					} catch (e) {
						isCondition = false;
					}
					deny = ((isCondition && entry.def === "allow") || (!isCondition && entry.def === "deny"));
					return(false);
				}
			}
		});
		if (deny) {
			res.send(403);
		} else {
			next();
		}						
	};
};