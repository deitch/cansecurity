const crypto = require('crypto'), jwt = require('jsonwebtoken'), now = require('./util').now;

let sessionKey = null, privKey = null, pubKey = null, encryptHeader = false, algorithm = null,
usePublic = false,
warn = () => {};


module.exports = {
  init : ({key = null, privateKey = null, publicKey = null, encrypt = false} = {}) => {
    sessionKey = key;
    privKey = privateKey;
    pubKey = publicKey;
    encryptHeader = encrypt;
    // which algorithm do we use?
    usePublic = privKey || pubKey ? true : false;
    algorithm = usePublic ? "RS256" : "HS256";
  },
  setWarn : (fn) => {
    warn = fn;
  },

  generate : (name, user, expiry) => {
    const token = jwt.sign({sub:name,exp:expiry,"cs-user":user},usePublic ? privKey : sessionKey,{algorithm:algorithm});
    return(encryptHeader ? module.exports.cipher(token) : token);
  },

  validate : (token) => {
    warn(`validating auth token ${token}`);
    const t = now();
    let valid = false, expiry, decoded;
    token = token || "";
    if (encryptHeader) {
      token = module.exports.decipher(token);
    }
    try {
      decoded = jwt.verify(token,usePublic ? pubKey : sessionKey,{algorithms:algorithm});
      expiry = decoded.exp;
      warn(`token expiry ${expiry} now ${t}`);
      warn(`token name ${decoded.sub}`);
      if (!isNaN(expiry) && parseInt(expiry,10) > t) {
        valid = decoded;
      } else {
        valid = false;
      }
    } catch (e) {
      valid = false;
    }

    warn(`token valid? ${valid}`);
    return(decoded);
  },

  cipher : (token) => {
    const cipher = crypto.createCipher('rc4-hmac-md5', sessionKey);
    return cipher.update(token, 'utf8','base64') + cipher.final('base64');
  },

  decipher : (token) => {
    const decipher = crypto.createDecipher('rc4-hmac-md5', sessionKey);
    return decipher.update(token, 'base64','utf8') + decipher.final('utf8');
  }
};
