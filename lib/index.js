/*jslint node:true */
// get the authentication/sessionManager library and the authorization library
const cansec = require('./sessionManager'),
  auth = require('./authorization'),
  declarative = require('./declarative'),
  constants = require('./constants');

module.exports = {
  init: (config) => {
    const ret = {}, that = this, authentication = cansec.init(config), authorization = auth.init(config);
    // initialize each part of the library
    constants.init(config);
    declarative.init(config);

    // merge the two into ret object
    // authentication methods
    Object.assign(ret,authentication,authorization);

    // declarative authorization
    that.authorizer = ret.authorizer = declarative.loadFile;
    that.getAuthMethod = ret.getAuthMethod;
    that.getUser = ret.getUser;

    return (ret);
  }
};
