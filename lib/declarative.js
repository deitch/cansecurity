/*jslint node:true, nomen:true */
var fs = require('fs'), vm = require('vm'), _ = require('lodash'), errors = require('./errors'), csauth = "X-CS-Auth",
/* 
 * pathRegexp from expressjs https://github.com/visionmedia/express/blob/master/lib/utils.js and modified per our needs
 * expressjs was released under MIT license as of this writing 
 * https://github.com/visionmedia/express/blob/9914a1eb3f7bbe01e3783fa70cb78e02570d7336/LICENSE 
 */
pathRegexp = function(path, keys, sensitive, strict) {
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
      keys.push({ name: key, optional: !! optional });
      slash = slash || '';
      return String(
        (optional ? '' : slash)
        + '(?:'
        + (optional ? slash : '')
        + (format || '') + (capture || ((format && '([^/.]+?)') || '([^/]+?)')) + ')'
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
	/* each rule is
	 * [verb,path,[param,][loggedIn,]default,condition]
	 * [string,string,[object,][boolean,]string,string]
	 */
	_.each(data.routes||[],function (rule) {
		// [verb, url, param, default, condition]
		var entry, verb, keys = [], re;
		rule = rule || [];
		// only 4, so we have no param or loggedIn
		if (rule.length === 4) {
			rule.splice(2,0,null,false);
		} else if (rule.length === 5) {
			// did we have the optional "loggedIn" boolean?
			if (typeof(rule[2]) === "boolean") {
				// insert a null for param
				rule.splice(2,0,null);
			} else {
				// we had the optional param
				rule.splice(3,0,false);
			}
		}
		verb = rule[0].toLowerCase();
		re = pathRegexp(rule[1],keys);
		entry = {
			verb: verb,
			url: rule[1],
			param: rule[2],
			loggedIn: rule[3],
			def: rule[4],
			condition: rule[5],
			re: re,
			keys: keys
		};
		routes[verb] = routes[verb] || [];
		routes[verb].push(entry);		
	});
	
	return function(req,res,next) {
		// authenticated: false = was not logged in and needed to be, send a 401, else check authorized
		// authorized: false = send a 403, else next()
		var authenticated = true, authorized = true, user = req[csauth], keys, match, oldParams = req.params;
		// first check verb, then check route regexp match, then check params
		_.each(routes[req.method.toLowerCase()],function (entry) {
			var useRule = false, isCondition = false;
			keys = {};
			// path match check
			match = (req.path||"").match(entry.re);
			if (match) {
				useRule = true;
				// create the important parameters
				_.each(entry.keys || [], function(p,i) {
					keys[p.name] = match[i+1];
				});
				// this is so that req.param() or req.params will work
				req.params = keys;
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
					// did we match the verb+path+param?
					// first check the authentication
					authenticated = !entry.loggedIn || !!req[csauth];
					// next check the authorization
					if (authenticated) {
						try {
							isCondition = vm.runInNewContext(entry.condition,{req:req,user:user,_:_});
						} catch (e) {
							isCondition = false;
						}
						authorized = ((!isCondition && entry.def === "allow") || (isCondition && entry.def === "deny"));
					}
				}
			}
		});
		// now reset req.params
		req.params = oldParams;
		if (!authenticated) {
			res.send(401,errors.unauthenticated());
		} else if (!authorized) {
			res.send(403,errors.unauthorized());
		} else {
			next();
		}						
	};
};