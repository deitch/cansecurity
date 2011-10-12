cansecurity
===========

Overview
--------
cansecurity is a security library for user authentication management in node (and specifically expressjs) apps.

cansecurity will manage your user authentication, handle stateless sessions, using both native express sessions and its own session mechanism, as you request. The cansecurity stateless session mechanism means that, with a shared secret, a user can be authenticated automatically across nodejs instances, essentially creating single-sign-on.

Usage
-----
Usage involves three key steps: installation, initialization and validation.

### Installation
Installation is fairly straightforward, just install the npm module:

    npm install cansecurity


### Initialization
To initialize cansecurity, you must first require() it, and then init() it:

    var cs = require('cansecurity');
    cs.init({});

In initialization, you set four key parameters as properties of the config object passed to cs.init():

* sessionExpiry: OPTIONAL. How long sessions should last. This is true both for expressjs sessions and CS sessions. Note that the change in expiry will only affect how long a session is valid for cansecurity. It will not affect the underlying expressjs session itself. The value of sessionExpiry is in minutes, and the default, if none is provided, is 15 minutes.
* sessionKey: OPTIONAL. This is the secret key shared between nodejs servers to provide single-sign-on. This is a string. The default, if none is provided, is a random 64-character string. If you do not provide a sessionKey, you cannot use single-sign-on.
* validatePass: REQUIRED. This is a function that will validate a username and password asynchronously and call a callback with success or failure. For more details, see below.
* getUser: REQUIRED. This is a function that will get a given user's username, password and user object, and pass them to a callback. For more details, see below.

### Validation
Validation is straightforward. Once you have set up cansecurity properly, it functions as standard expressjs middleware:

    server.use(cs.validate);

This should generally be done **before** your router.

If the user is successfully authenticated, then the user object will be placed in two locations:

    req["X-CS-Auth"];
    req.session["X-CS-AUTH"].user;  // only if expressjs sessions have been enabled


Required Options
----------------

validatePass: validatePass must have the following signature

    validatePass(username,password,callback);

The validatePass function is expected to validate a given password for a given username, and indicate to the callback if it succeeded or failed. The signature and expected parameters to the callback are as follows:

    callback(user,message,pass);

Where:
	user = the actual user object. This can be a function, a JavaScript object, anything you want. It will be placed inside the session and the request for you to use later. If validation was successful, this must not be null/undefined.
	message = the error message in case of validation failure. This can be anything you want, and will be passed along with the 401 unauthenticated response. 
	pass = the user's password or any other unique per-user string, not easily guessable. Commonly, this would be the hash of a password. 
	
getUser: getUser returns a user object for a given user. This is only called when we do not need/use the password to validate the user. If we did, we would already have the user from validatePass(). Rather, we use getUser to get a user object and generate a new set of auth credentials for user who we authenticated using either a local expressjs session or a CS session. 

getUser has the following signature:
	
	getUser(username,success,failure);

getUser is expected to know what to do with a given username, and get the user object to pass to the callback. The signature and expected parameters of the success callback are as follows:

	success(user,login,password);
	
Where:
	user = the actual user object. This can be a function, a JavaScript object, anything you want. It will be placed inside the session and the request for you to use later. If such a user is found, this must not be null/undefined.
	pass = the user's password or any other unique per-user string, not easily guessable. Commonly, this would be the hash of a password.
	
The signature and expected parameters of the failure callback are as follows:

	failure(error);

Unauthenticated Errors
----------------------
cansecurity will never directly return errors. It will authenticate a user, or fail to do so, set request["X-CS-Auth"], and request.session["X-CS-Auth"] if sessions are enabled, and then call next() to jump to the next middleware. 

cansecurity **will** call next(error) in only the following case: 
If the user has provided HTTP Basic Authentication credentials in the form of username/password **and** the authentication fails. In that case, cansecurity will call 

    next({status: 401, message:"some message"});

It is up to you to make sure that you use expressjs's server.error() handler to correctly handle this error.

Why We Need the Password
------------------------
getUser() and validatePassword() both require the calling program to return a password. Although this is never passed out, why is the password necessary? 

In reality, this can be any unique string at all, as long as it is consistent for the same user. Normally, this would be a hashed password. This is used, along with the secret session key, to create the authtoken for CS sessions. Without using the password or some other unique, non-guessable string, it would be theoretically possible to use one login to spoof another. With the unique non-guessable user string (hashed password or similar) as part of the hash input, this risk is mitigated. PLEASE PLEASE PLEASE do not pass cleartext passwords here. In reality, your app should never know cleartext passwords, rather storing them as SHA1 or similar hashes. 

Thus, to create a unique authentication token that is useful for single-sign-on and cannot be spoofed to another user, we include the unique user string (e.g. a hashed password) as part of the input to the authentication token.

How Authentication Works
------------------------
With each request, the following algorithm is followed:

* Was there an HTTP Basic authentication header? If so, validate using the credentials. If they succeed, the user is authenticated, else send back a 401 unauthenticated and include a response X-CS-Auth header of "error=invalidpass". If not, go to the next step.
* Was there an X-CS-Auth header? If so, validate using the auth header. If they success, the user is authenticated, else they are not. The requests will continue, but the response will contain an X-CS-Auth header of "error=invalidtoken". If not, go to the next step.
* Is there a valid and non-expired expressjs session? If so, the user is authenticated. If not, go to the next step.
* The user is not authenticated.

Note that failing to get an authentication for all of the above steps does **not** necessarily indicate that a 401 or 403 should be sent back. It is entirely possible that the user is accessing a resource that does not require authentication! This part of the cansecurity library is entirely about authentication; authorization is a different topic.

The X-CS-Auth Header
--------------------
The X-CS-Auth header contains error responses or success tokens. If authentication was successful, by any means, then a new header is generated with each request. This header is of the following format:

    success=sha1hash:username:expiry

Where:
	sha1hash = a sha1 hash of the username, the expiry, the secret session key and the user's unique string (likely itself a hashed password).
	username = the user's username
	expiry = when this auth token will expire, as a JavaScript (Unix) millisecond timestamp, provided by Date().getTime().
	
Essentially, we are using a message validation algorithm to validate that the username and expiry are, indeed, valid.

Because the auth header is created anew with each request, the expiry window is rolling - x minutes from the last valid request.

Performance
-----------
Extensive performance testing has not been done. However, all of the algorithms are symmetric, which are very high-performance. The expensive part is getUser() and validatePassword(), which may require your app to look in a data source or database. However, since the majority of requests will simply hit the local session, the user will be stored locally, and it is not an issue. The hit will only be for the first authentication for each user, as well as when a user switches between nodejs servers using SSO.

Example
-------
For a good example, see the test suite in test/test.js, specifically the section beginning cansec.init. It is reproduced below:

```JavaScript
var cansec = require('cansecurity'), 
// static database for testing
user = {name:"john",pass:"1234",age:25};

cansec.init({
	getUser: function(login,success,failure){
		if (user.name === login) {
			success(user,user.name,user.pass);
		} else {
			failure();
		}
	},
	validatePassword: function(login,pass,cb){
		var p = null, message, resuser = null;
		if (user.name !== login) {
			message = "invaliduser";
		} else if (user.pass !== pass) {
			message = "invalidpass";
		} else {
			message = null;
			resuser = user;
			p = pass;
		}
		cb(resuser,message,p);
	},
	sessionKey: SESSIONKEY
});


// create our express server
server = express.createServer();
server.configure(function(){
	server.use(express.cookieParser());	
	server.use(express.session({secret: "agf67dchkQ!"}));
	server.use(cansec.validate);
	server.use(function(req,res,next){
		// send a 200
		sendResponse(req,res,200);
	});
});
server.error(function(err,req,res,next){
	var data;
	if (err && err.status) {
		// one of ours
		data = err.message ? {message: err.message} : null;
		sendResponse(req,res,err.status,data);
	} else if (err && err.type && err.type === "unexpected_token") {
		// malformed data
		sendResponse(req,res,{message:err.type},400);
	} else {
		sendResponse(req,res,500);
	}
	
});
server.listen(PORT);
```
