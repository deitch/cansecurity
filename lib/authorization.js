/*jslint node:true, nomen:false */
var errors = require('./errors'),
  constants = require('./constants').get(),
  csauth = constants.header.AUTH,
  fields = {}, params = {},
  checkLoggedIn, checkSelf, checkUserRoles, checkParam, checkField, fns, i, j;

checkLoggedIn = function (req, res, next) {
  // If our user is authenticated
  // then everything is fine :)
  var logged = true;
  if (!req[csauth]) {
    res.send(401, errors.unauthenticated());
    logged = false;
  }
  return (logged);
};
checkSelf = function (req, res, next) {
  var isSelf = false;
  if (req[csauth][fields.id].toString() === req.param(params.id).toString()) {
    isSelf = true;
    next();
  }
  return (isSelf);
};
checkUserRoles = function (req, res, next, roles) {
  var userRoles = req[csauth][fields.roles],
    isRole = false,
    i, targetRoles = {};
  roles = roles || [];
  for (i = 0; i < roles.length; i++) {
    targetRoles[roles[i]] = true;
  }
  if (userRoles && userRoles.length && userRoles.length > 0) {
    for (i = 0; i < userRoles.length; i++) {
      if (targetRoles[userRoles[i]]) {
        isRole = true;
      }
    }
    if (isRole) {
      next();
    }
  }
  return (isRole);
};
checkParam = function (req, res, next, param) {
  var isParam = false,
    id = req[csauth][fields.id],
    i;
  param = [].concat(param);
  // check the ID of the user against each field in each result for which it is allowed
  for (i = 0; i < param.length; i++) {
    if (id === req.param(param[i])) {
      isParam = true;
      break;
    }
  }
  if (isParam) {
    next();
  }
  return (isParam);
};
checkField = function (req, res, next, field, getObject) {
  var id = req[csauth][fields.id],
    i, j, valid, list = [].concat(getObject(req, res) || {});
  // check the ID of the user against each field in each result for which it is allowed, for each object
  // *all* must pass to be allowed
  for (j = 0; j < list.length; j++) {
    valid = false;
    for (i = 0; i < field.length; i++) {
      if (id === list[j][field[i]]) {
        valid = true;
        break;
      }
    }
    if (!valid) {
      break;
    }
  }
  if (valid) {
    next();
  }
  return (valid);
};

fns = {
  direct: {
    // valid if the user is logged in
    restrictToLoggedIn: function (req, res, next) {
      // If our user is authenticated
      // then everything is fine :)
      if (checkLoggedIn(req, res, next)) {
        next();
      }
    },
    // valid if user is logged in *and* the ID if the logged-in user is equal to the ID param
    restrictToSelf: function (req, res, next) {
      // If our authenticated user is the user we are viewing
      // then everything is fine :)
      if (checkLoggedIn(req, res, next)) {
        if (!checkSelf(req, res, next)) {
          res.send(403, errors.unauthorized());
        }
      }
    }
  },
  indirect: {
    // valid if user is logged in *and* the logged-in user has at least one of the given roles
    restrictToRoles: function (roles) {
      roles = roles ? [].concat(roles) : [];
      return function (req, res, next) {
        if (checkLoggedIn(req, res, next)) {
          if (!checkUserRoles(req, res, next, roles)) {
            res.send(403, errors.unauthorized());
          }
        }
      };
    },
    // valid if user is logged in *and* the logged-in user is equal to the ID param *or* user has at least one of the given roles
    restrictToSelfOrRoles: function (roles) {
      roles = roles ? [].concat(roles) : [];
      return function (req, res, next) {
        if (checkLoggedIn(req, res, next)) {
          if (!checkSelf(req, res, next)) {
            if (!checkUserRoles(req, res, next, roles)) {
              res.send(403, errors.unauthorized());
            }
          }
        }
      };
    },
    // valid if user is logged in *and* some given field is the same as a given param
    restrictToParam: function (param) {
      return function (req, res, next) {
        if (checkLoggedIn(req, res, next)) {
          if (!checkParam(req, res, next, param)) {
            res.send(403, errors.unauthorized());
          }
        }
      };
    },
    // valid if user is logged in *and* some given field is the same as a given param *or* user has one of the given roles
    restrictToParamOrRoles: function (param, roles) {
      roles = roles ? [].concat(roles) : [];
      param = param ? [].concat(param) : [];
      return function (req, res, next) {
        // valid if the user name is the same as the param name, or the logged in user is an admin
        if (checkLoggedIn(req, res, next)) {
          if (!checkUserRoles(req, res, next, roles)) {
            if (!checkParam(req, res, next, param)) {
              res.send(403, errors.unauthorized());
            }
          }
        }
      };
    },
    // valid if user is logged in *and* the ID of the logged-in user is equivalent to some field on an arbitrary object
    restrictToField: function (field, getField) {
      field = field ? [].concat(field) : [];
      return function (req, res, next) {
        // valid if the user name is the same as the param name, or the logged in user is an admin
        if (checkLoggedIn(req, res, next)) {
          if (!checkField(req, res, next, field, getField)) {
            res.send(403, errors.unauthorized());
          }
        }
      };
    },
    // valid if user is logged in *and* the ID of the logged-in user is equivalent to some field on an arbitrary object *or* user has one of the given roles
    restrictToFieldOrRoles: function (field, roles, getField) {
      roles = roles ? [].concat(roles) : [];
      field = field ? [].concat(field) : [];
      return function (req, res, next) {
        // valid if the user name is the same as the param name, or the logged in user is an admin
        if (checkLoggedIn(req, res, next)) {
          if (!checkUserRoles(req, res, next, roles)) {
            if (!checkField(req, res, next, field, getField)) {
              res.send(403, errors.unauthorized());
            }
          }
        }
      };
    }
  },
  ifs: {
    // limit our restriction to if a certain param has a certain value
    ifParam: function (param, val) {
      var that = {}, i, j, makeMiddleware, makeIndirectMiddleware;
      makeMiddleware = function (fn) {
        return function (req, res, next) {
          if ((req.query && req.query[param] === val) || (req.body && req.body[param] === val)) {
            fn(req, res, next);
          } else {
            next();
          }
        };
      };
      makeIndirectMiddleware = function (middleware) {
        return function () {
          return makeMiddleware(middleware.apply(that, arguments));
        };
      };
      // wrap the possible return functions
      for (i in fns.direct) {
        if (fns.direct.hasOwnProperty(i)) {
          that[i] = makeMiddleware(fns.direct[i]);
        }
      }
      for (j in fns.indirect) {
        if (fns.indirect.hasOwnProperty(j)) {
          that[j] = makeIndirectMiddleware(fns.indirect[j]);
        }
      }
      return that;
    }
  }
};

var that = {};
for (i in fns) {
  if (fns.hasOwnProperty(i)) {
    for (j in fns[i]) {
      if (fns[i].hasOwnProperty(j)) {
        that[j] = fns[i][j];
      }
    }
  }
}
// pass required configs:
// - the ID field in the object that is stored
// - the roles field in the object that is stored
// - the name of the ID param when checking if the requesting user is the logged in user
module.exports = {
  init: function (config) {
    config = config || {};
    config.fields = config.fields || {};
    config.params = config.params || {};
    fields.id = config.fields.id || "id";
    fields.roles = config.fields.roles || "roles";
    params.id = config.params.id || "user";
    return (that);
  }
};