/*jslint node:true, nomen:false */
var errors = require('./errors'), csauth = "X-CS-Auth", fields = {}, params = {},
	checkLoggedIn, checkSelf, checkUserRoles, checkParam, checkField;
	
checkLoggedIn = function(req,res,next) {
	// If our user is authenticated
	// then everything is fine :)
	var logged = true;
	if (!req[csauth]) {
		next(errors.unauthenticated());
		logged = false;
	}
	return(logged);
};
checkSelf = function(req,res,next) {
	var isSelf = false;
	if (req[csauth][fields.id] === req.params[params.id]) {
		isSelf = true;
		next();
	}
	return(isSelf);
};
checkUserRoles = function(req,res,next,roles) {
	var userRoles = req[csauth][fields.roles], isRole = false, i, targetRoles = {};
	roles = roles || [];
	for (i=0;i<roles.length;i++) {
		targetRoles[roles[i]] = true;
	}
	if (userRoles && userRoles.length && userRoles.length > 0) {
		for (i=0;i<userRoles.length;i++) {
			if (targetRoles[userRoles[i]]) {
				isRole = true;
			}
		}
		if (isRole) {
			next();
		}
	}
	return(isRole);
};
checkParam = function(req,res,next,param) {
	var isParam = false, id = req[csauth][fields.id], i;
	// check the ID of the user against each field in each result for which it is allowed
	for (i=0;i<param.length;i++) {
		if (id === req.param(param[i])) {
			isParam = true;
			break;
		}
	}
	if (isParam) {
		next();
	}
	return(isParam);
	
};
checkField = function(req,res,next,field,getObject) {
	var id = req[csauth][fields.id], i, valid = false, obj = getObject(req,res) || {};
	// check the ID of the user against each field in each result for which it is allowed
	for (i=0;i<field.length;i++) {
		if (id === obj[field[i]]) {
			valid = true;
			break;
		}
	}
	if (valid) {
		next();
	}
	return(valid);
};


var that = {
	// valid if the user is logged in
	restrictToLoggedIn : function(req,res,next) {
		// If our user is authenticated
		// then everything is fine :)
		if (checkLoggedIn(req,res,next)) {
			next();
		}
	},
	// valid if user is logged in *and* the ID if the logged-in user is equal to the ID param
	restrictToSelf : function(req,res,next) {
		// If our authenticated user is the user we are viewing
		// then everything is fine :)
		if (checkLoggedIn(req,res,next)) {
			if (!checkSelf(req,res,next)) {
				next(errors.unauthorized());
			}
		}
	},
	// valid if user is logged in *and* the logged-in user has at least one of the given roles
	restrictToRoles : function(roles) {
		var userRoles;
		roles = roles ? [].concat(roles) : [];
		return function(req,res,next) {
			var allowed = false, i, userRoles;
			if (checkLoggedIn(req,res,next)) {
				if (!checkUserRoles(req,res,next,roles)) {
					next(errors.unauthorized());
				}
			}
		};
	}, 
	// valid if user is logged in *and* the logged-in user is equal to the ID param *or* user has at least one of the given roles
	restrictToSelfOrRoles : function(roles) {
		roles = roles ? [].concat(roles) : [];
		return function(req,res,next) {
			var allowed = false, i, userRoles;
			if (checkLoggedIn(req,res,next)) {
				if (!checkSelf(req,res,next)) {
					if (!checkUserRoles(req,res,next,roles)) {
						next(errors.unauthorized());
					}
				}
			}
		};
	},
	// valid if user is logged in *and* some given field is the same as a given param
	restrictToParam : function(param) {
		return function(req,res,next) {
			var allowed = false, i, userRoles;
			if (checkLoggedIn(req,res,next)) {
				if (!checkParam(req,res,next,param)) {
					next(errors.unauthorized());
				}
			}

		};
	},
	// valid if user is logged in *and* some given field is the same as a given param *or* user has one of the given roles
	restrictToParamOrRoles : function(param,roles) {
		roles = roles ? [].concat(roles) : [];
		param = param ? [].concat(param) : [];
		return function(req,res,next) {
			// valid if the user name is the same as the param name, or the logged in user is an admin
			var allowed = false, i, userRoles, id, valid = false;
			if (checkLoggedIn(req,res,next)) {
				if (!checkUserRoles(req,res,next,roles)) {
					if (!checkParam(req,res,next,param)) {
						next(errors.unauthorized());
					}
				}
			}
		};
	},
	// valid if user is logged in *and* the ID of the logged-in user is equivalent to some field on an arbitrary object
	restrictToField : function(field,getField) {
		field = field ? [].concat(field) : [];
		return function(req,res,next) {
			// valid if the user name is the same as the param name, or the logged in user is an admin
			if (checkLoggedIn(req,res,next)) {
				if (!checkField(req,res,next,field,getField)) {
					next(errors.unauthorized());
				}
			}
		};
	},
	// valid if user is logged in *and* the ID of the logged-in user is equivalent to some field on an arbitrary object *or* user has one of the given roles
	restrictToFieldOrRoles : function(field,roles,getField) {
		roles = roles ? [].concat(roles) : [];
		field = field ? [].concat(field) : [];
		return function(req,res,next) {
			// valid if the user name is the same as the param name, or the logged in user is an admin
			if (checkLoggedIn(req,res,next)) {
				if (!checkUserRoles(req,res,next,roles)) {
					if (!checkField(req,res,next,field,getField)) {
						next(errors.unauthorized());
					}
				}
			}
		};
	}
};


// pass required configs:
// - the ID field in the object that is stored
// - the roles field in the object that is stored
// - the name of the ID param when checking if the requesting user is the logged in user
module.exports = {
	init: function(config) {
		config = config || {};
		config.fields = config.fields || {};
		config.params = config.params || {};
		fields.id = config.fields.id || "id";
		fields.roles = config.fields.roles || "roles";
		params.id = config.params.id || "user";
		return(that);
	}
};
