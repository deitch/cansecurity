/*jslint node:true, nomen:false, unused:vars */
const errors = require('./errors'), rparams = require('./param'), sender = require('./sender'),
  constants = require('./constants').get(),
  csauth = constants.header.AUTH,
  fields = {}, params = {};
// initialize [TODO: overridable] global default
var unauthenticatedcode = constants.httpcodes.UNAUTHENTICATED;

const checkLoggedIn = (req, res, next, unauthenticatedResponse = {code:unauthenticatedcode}) => {
    // If our user is authenticated
    // then everything is fine :)
    let logged = true;
    rparams(req);
    if (!req[csauth]) {
      unauthenticatedResponse = unauthenticatedResponse || {code:unauthenticatedcode};
      unauthenticatedResponse.code = unauthenticatedResponse.code || unauthenticatedcode; 
      unauthenticatedResponse.location = unauthenticatedResponse.location || null; 
      if (unauthenticatedResponse.location != null) {
        res.header("location", unauthenticatedResponse.location);
      }
      sender(res,unauthenticatedResponse.code,errors.unauthenticated(),unauthenticatedResponse);
      logged = false;
    }
    return (logged);
  },
  checkSelf = function (req, res, next) {
    const userid = (req.params[params.id] || req.body[params.id] || "").toString();
    let isSelf = false;
    rparams(req);
    if (req[csauth][fields.id].toString() === userid) {
      isSelf = true;
      next();
    }
    return (isSelf);
  },
  checkUserRoles = (req, res, next, roles) => {
    const userRoles = req[csauth][fields.roles], targetRoles = {};
    rparams(req);
    roles = roles || [];
    for (let i of roles) {
      targetRoles[i] = true;
    }
    let isRole = false;
    for (let i of userRoles || []) {
      if (targetRoles[i]) {
        isRole = true;
        break;
      }
    }
    if (isRole) {
      next();
    }
    return (isRole);
  },
  checkParam = (req, res, next, param) => {
    const id = req[csauth][fields.id];
    let isParam = false;
    rparams(req);
    param = [].concat(param);
    // check the ID of the user against each field in each result for which it is allowed
    for (let i of param) {
      if (id === req.param(i)) {
        isParam = true;
        break;
      }
    }
    if (isParam) {
      next();
    }
    return (isParam);
  },
  checkField = (req, res, next, field, getObject) => {
    const id = req[csauth][fields.id], list = [].concat(getObject(req, res) || {});
    let valid;
    rparams(req);
    // check the ID of the user against each field in each result for which it is allowed, for each object
    // *all* must pass to be allowed
    for (let item of list) {
      valid = false;
      for (let name of field) {
        if (id === item[name]) {
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
  },

  fns = {
    direct: {
      // valid if the user is logged in
      restrictToLoggedIn: (req, res, next) => {
        // If our user is authenticated
        // then everything is fine :)
        checkLoggedIn(req, res, next) && next();
      },
      // valid if user is logged in *and* the ID if the logged-in user is equal to the ID param
      restrictToSelf: (req, res, next) => {
        // If our authenticated user is the user we are viewing
        // then everything is fine :)
        checkLoggedIn(req, res, next) && !checkSelf(req, res, next) &&  sender(res,403,errors.unauthorized());
      }
    },
    indirect: {
      unauthenticated: (unauthenticatedResponse) => {
        return (req, res, next) => {
          checkLoggedIn(req, res, next, unauthenticatedResponse) && next();
        };
      },
      // valid if user is logged in *and* the logged-in user has at least one of the given roles
      restrictToRoles: (roles) => {
        roles = roles ? [].concat(roles) : [];
        return (req, res, next) => {
          checkLoggedIn(req, res, next) && !checkUserRoles(req, res, next, roles) &&  sender(res,403,errors.unauthorized());
        };
      },
      // valid if user is logged in *and* the logged-in user is equal to the ID param *or* user has at least one of the given roles
      restrictToSelfOrRoles: (roles) => {
        roles = roles ? [].concat(roles) : [];
        return (req, res, next) => {
          checkLoggedIn(req, res, next) &&
            !checkSelf(req, res, next) &&
              !checkUserRoles(req, res, next, roles) &&
                sender(res,403,errors.unauthorized());
        };
      },
      // valid if user is logged in *and* some given field is the same as a given param
      restrictToParam: (param) =>
        (req, res, next) => {
          checkLoggedIn(req, res, next) &&
            !checkParam(req, res, next, param) &&
              sender(res,403,errors.unauthorized());
        }
      ,
      // valid if user is logged in *and* some given field is the same as a given param *or* user has one of the given roles
      restrictToParamOrRoles: (param, roles) => {
        roles = roles ? [].concat(roles) : [];
        param = param ? [].concat(param) : [];
        return (req, res, next) => {
          // valid if the user name is the same as the param name, or the logged in user is an admin
          checkLoggedIn(req, res, next) &&
            !checkUserRoles(req, res, next, roles) &&
              !checkParam(req, res, next, param) &&
                sender(res,403,errors.unauthorized());
        };
      },
      // valid if user is logged in *and* the ID of the logged-in user is equivalent to some field on an arbitrary object
      restrictToField: (field, getField) => {
        field = field ? [].concat(field) : [];
        return (req, res, next) => {
          // valid if the user name is the same as the param name, or the logged in user is an admin
          checkLoggedIn(req, res, next) &&
            !checkField(req, res, next, field, getField) &&
              sender(res,403,errors.unauthorized());
        };
      },
      // valid if user is logged in *and* the ID of the logged-in user is equivalent to some field on an arbitrary object *or* user has one of the given roles
      restrictToFieldOrRoles: (field, roles, getField) => {
        roles = roles ? [].concat(roles) : [];
        field = field ? [].concat(field) : [];
        return (req, res, next) => {
          // valid if the user name is the same as the param name, or the logged in user is an admin
          checkLoggedIn(req, res, next) &&
            !checkUserRoles(req, res, next, roles) &&
              !checkField(req, res, next, field, getField) &&
                sender(res,403,errors.unauthorized());
        };
      }
    },
    ifs: {
      // limit our restriction to if a certain param has a certain value
      ifParam: (param, val) => {
        let that = {};
        const
          makeMiddleware = (fn) =>
            (req, res, next) => {
              if ((req.query && req.query[param] === val) || (req.body && req.body[param] === val)) {
                fn(req, res, next);
              } else {
                next();
              }
            },
          makeIndirectMiddleware = (middleware) =>
            // this cannot be an arrow function because we use arguments
            function () {
              return makeMiddleware(middleware.apply(that, arguments));
            }
          //makeIndirectMiddleware = (middleware) => () => makeMiddleware(middleware.apply(that, arguments))
            ;
        // wrap the possible return functions
        for (let i of Object.keys(fns.direct)) {
          that[i] = makeMiddleware(fns.direct[i]);
        }
        for (let i of Object.keys(fns.indirect)) {
          that[i] = makeIndirectMiddleware(fns.indirect[i]);
        }
        return that;
      }
    }
  };

const that = {};
for (let i of Object.keys(fns)) {
  Object.assign(that,fns[i]);
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
