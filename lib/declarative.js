/*jslint node:true, nomen:true */
var fs = require('fs'),
	vm = require('vm'),
	_ = require('lodash'),
	async = require('async'),
	errors = require('./errors'),
	constants = require('./constants').get(),
	csauth = constants.header.AUTH,
	/* 
	 * pathRegexp from expressjs https://github.com/visionmedia/express/blob/master/lib/utils.js and modified per our needs
	 * expressjs was released under MIT license as of this writing
	 * https://github.com/visionmedia/express/blob/9914a1eb3f7bbe01e3783fa70cb78e02570d7336/LICENSE
	 */
	pathRegexp = function (path, keys, sensitive, strict) {
		if (path && path.toString() === '[object RegExp]') {
			return path;
		}
		if (Array.isArray(path)) {
			path = '(' + path.join('|') + ')';
		}
		path = path.concat(strict ? '' : '/?').replace(/\/\(/g, '(?:/').replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function (_, slash, format, key, capture, optional, star) {
			keys.push({
				name: key,
				optional: !! optional
			});
			slash = slash || '';
			return String(
				(optional ? '' : slash) + '(?:' + (optional ? slash : '') + (format || '') + (capture || ((format && '([^/.]+?)') || '([^/]+?)')) + ')' + (optional || '') + (star ? '(/*)?' : ''));
		}).replace(/([\/.])/g, '\\$1').replace(/\*/g, '(.*)');
		return new RegExp('^' + path + '$', sensitive ? '' : 'i');
	}, 
	pathToFormat = function (path,format) {
		var ret = (!format || path.match(/(\/|\.\:\w+\?)$/)) ? path : path + ".:format?";
		return(ret);
	},
	loader;

module.exports = {
	init: function (config) {
		loader = (config || {}).loader;
	},
	loadFile: function (cfile,options) {
		var data, routes = {}, fpath;
		options = options || {};
		// source the config file
		/*jslint stupid:true */
		data = fs.readFileSync(cfile, "utf8");
		/*jslint stupid:false */
		data = JSON.parse(data) || {};
		// do we have rules?
		/* each rule is
		 * [verb,path,[param,][loggedIn,][loader,]condition]
		 * [string,string,[object,][boolean,][string,]string]
		 */
		_.each(data.routes || [], function (rule) {
			var entry, verb, keys = [],
				re;
			rule = rule || [];
			if (typeof (rule[2]) !== "object") {
				rule.splice(2, 0, null);
			}
			if (typeof (rule[3]) !== "boolean") {
				rule.splice(3, 0, false);
			}
			if (rule.length < 6) {
				rule.splice(4, 0, null);
			}
			verb = rule[0].toLowerCase();
			fpath = pathToFormat(rule[1],options.format);
			re = pathRegexp(fpath,keys);
			entry = {
				verb: verb,
				url: rule[1],
				param: rule[2],
				loggedIn: rule[3],
				loader: rule[4],
				condition: rule[5],
				re: re,
				keys: keys
			};
			routes[verb] = routes[verb] || [];
			routes[verb].push(entry);
		});
		return function (req, res, next) {
			// authenticated: false = was not logged in and needed to be, send a 401, else check authorized
			// authorized: false = send a 403, else next()
			var user = req[csauth],
				keys, match, oldParams = req.params;
				
			// first check verb, then check route regexp match, then check params
			async.each(routes[req.method.toLowerCase()], function (entry, callback) {
				var useRule = false,
					checkCondition = function (condition, req, user, item) {
						var authorized;
						try {
							authorized = vm.runInNewContext(condition, {
								req: req,
								request: req,
								user: user,
								_: _,
								item: item
							});
						} catch (e) {
							authorized = false;
						}
						return (authorized);
					};
				keys = {};
				// path match check
				match = (req.path || "").match(entry.re);
				if (match) {
					useRule = true;
					// create the important parameters
					_.each(entry.keys || [], function (p, i) {
						keys[p.name] = match[i + 1];
					});
					// this is so that req.param() or req.params will work
					req.params = keys;
					// next check if we use param - will be false unless no param, or param is match
					if (entry.param) {
						useRule = false;
						_.each(entry.param, function (val, key) {
							if (val !== null && val !== undefined && req.param(key) === val) {
								useRule = true;
							}
						});
					}
					if (useRule) {
						// did we match the verb+path+param?
						// first check the authentication
						// authenticated = !entry.loggedIn || !!req[csauth];
						if (entry.loggedIn && !req[csauth]) {
							callback([401, errors.unauthenticated()]);
						} else {
							// next check for the loader
							if (entry.loader) {
								try {
									req.cansecurity = req.cansecurity || {};
									loader[entry.loader](req, res, function (err) {
										if (err) {
											next(err);
										} else {
											callback(checkCondition(entry.condition, req, user, (req.cansecurity || {}).item) ? undefined : [403, errors.unauthorized()]);
										}
									});
								} catch (err) {
									callback([500, errors.uninitialized()]);
								}
							} else {
								callback(checkCondition(entry.condition, req, user) ? undefined : [403, errors.unauthorized()]);
							}
						}
					} else {
						callback();
					}
				} else {
					callback();
				}
			}, function (err) {
				// now reset req.params
				req.params = oldParams;
				if (err) {
					res.send.apply(res, err);
				} else {
					next();
				}
			});
		};
	}
};
