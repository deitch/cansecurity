cansecurity
===========

Overview
--------
cansecurity is a security library for user authentication management and authorization in node (and specifically expressjs) apps.

### Authentication
cansecurity will manage your user authentication, handle stateless sessions, using both native express sessions and its own session mechanism, as you request. The cansecurity stateless session mechanism means that, with a shared secret, a user can be authenticated automatically across nodejs instances, essentially creating single-sign-on.

### Authorization
cansecurity also provides middleware to handle authorization in your requests. It is structured in a manner similar to the expressjs examples restrictTo*.

Installation
------------
Installation is fairly straightforward, just install the npm module:

    npm install cansecurity


Authentication
--------------
### Usage
Usage involves two key steps: initialization and validation.

#### Installation

#### Initialization
To initialize cansecurity, you must first require() it, and then init() it, which will return the middleware you can use:

````JavaScript
var cs = require('cansecurity');
var cansec = cs.init({});
````

In initialization, you set four key authentication parameters as properties of the config object passed to cs.init():

* sessionExpiry: OPTIONAL. How long sessions should last. This is true both for expressjs sessions and CS sessions. Note that the change in expiry will only affect how long a session is valid for cansecurity. It will not affect the underlying expressjs session itself. The value of sessionExpiry is in minutes, and the default, if none is provided, is 15 minutes.
* sessionKey: OPTIONAL. This is the secret key shared between nodejs servers to provide single-sign-on. This is a string. The default, if none is provided, is a random 64-character string. If you do not provide a sessionKey, you cannot use single-sign-on.
* validatePass: REQUIRED. This is a function that will validate a username and password asynchronously and call a callback with success or failure. For more details, see below.
* getUser: REQUIRED. This is a function that will get a given user's username, password and user object, and pass them to a callback. For more details, see below.

#### Validation
Validation is straightforward. Once you have set up cansecurity properly, it functions as standard expressjs middleware:

    server.use(cansec.validate);

This should generally be done **before** your router.

If the user is successfully authenticated, then the user object will be placed in two locations:

    req["X-CS-Auth"];
    req.session["X-CS-AUTH"].user;  // only if expressjs sessions have been enabled


### Required Options

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

### Unauthenticated Errors
cansecurity will never directly return errors. It will authenticate a user, or fail to do so, set request["X-CS-Auth"], and request.session["X-CS-Auth"] if sessions are enabled, and then call next() to jump to the next middleware. 

cansecurity **will** call next(error) in only the following case: 
If the user has provided HTTP Basic Authentication credentials in the form of username/password **and** the authentication fails. In that case, cansecurity will call 

    next({status: 401, message:"some message"});

It is up to you to make sure that you use expressjs's server.error() handler to correctly handle this error.

### Why We Need the Password
getUser() and validatePassword() both require the calling program to return a password. Although this is never passed out, why is the password necessary? 

In reality, this can be any unique string at all, as long as it is consistent for the same user. Normally, this would be a hashed password. This is used, along with the secret session key, to create the authtoken for CS sessions. Without using the password or some other unique, non-guessable string, it would be theoretically possible to use one login to spoof another. With the unique non-guessable user string (hashed password or similar) as part of the hash input, this risk is mitigated. PLEASE PLEASE PLEASE do not pass cleartext passwords here. In reality, your app should never know cleartext passwords, rather storing them as SHA1 or similar hashes. 

Thus, to create a unique authentication token that is useful for single-sign-on and cannot be spoofed to another user, we include the unique user string (e.g. a hashed password) as part of the input to the authentication token.

### How Authentication Works
With each request, the following algorithm is followed:

* Was there an HTTP Basic authentication header? If so, validate using the credentials. If they succeed, the user is authenticated, else send back a 401 unauthenticated and include a response X-CS-Auth header of "error=invalidpass". If not, go to the next step.
* Was there an X-CS-Auth header? If so, validate using the auth header. If they success, the user is authenticated, else they are not. The requests will continue, but the response will contain an X-CS-Auth header of "error=invalidtoken". If not, go to the next step.
* Is there a valid and non-expired expressjs session? If so, the user is authenticated. If not, go to the next step.
* The user is not authenticated.

Note that failing to get an authentication for all of the above steps does **not** necessarily indicate that a 401 or 403 should be sent back. It is entirely possible that the user is accessing a resource that does not require authentication! This part of the cansecurity library is entirely about authentication; authorization is a different topic.

### The X-CS-Auth Header
The X-CS-Auth header contains error responses or success tokens. If authentication was successful, by any means, then a new header is generated with each request. This header is of the following format:

    success=sha1hash:username:expiry

Where:
	sha1hash = a sha1 hash of the username, the expiry, the secret session key and the user's unique string (likely itself a hashed password).
	username = the user's username
	expiry = when this auth token will expire, as a JavaScript (Unix) millisecond timestamp, provided by Date().getTime().
	
Essentially, we are using a message validation algorithm to validate that the username and expiry are, indeed, valid.

Because the auth header is created anew with each request, the expiry window is rolling - x minutes from the last valid request.

### Performance
Extensive performance testing has not been done. However, all of the algorithms are symmetric, which are very high-performance. The expensive part is getUser() and validatePassword(), which may require your app to look in a data source or database. However, since the majority of requests will simply hit the local session, the user will be stored locally, and it is not an issue. The hit will only be for the first authentication for each user, as well as when a user switches between nodejs servers using SSO.

### Example
For a good example, see the test suite in test/test.js, specifically the section beginning cansec.init. It is reproduced below:

```JavaScript
var cs = require('cansecurity'), cansec,
// static database for testing
user = {name:"john",pass:"1234",age:25};

cansec = cs.init({
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

Authorization
-------------
Authorization is structured as route-specific middleware. Once authentication has (or has not) been performed, it is possible to restrict access to a particular route.

The easiest way to demonstrate this is with an example, following which we will describe all of the options and APIs.

### Example
````JavaScript
express = require('express'),
cansec = require('cansecurity').init({});
server = express.createServer();
// do lots of server initialization
server.get("/some/route/:user",cansec.restrictToLoggedIn,routeHandler);

````

### Usage
Usage of cansecurity authorization is only possible if you are using cansecurity authentication as well. To use authorization, you do two steps: initialization and middleware.

#### Initialization
The authorization component of cansecurity is initialized at the same time as the authentication component:

````JavaScript
var cs = require('cansecurity'), cansec;
cansec = cs.init({});
````

or more simply:

````JavaScript
var cansec = require('cansecurity').init({});
````

In initialization, you set two key authorization parameters as properties of the config object passed to cs.init(). Both are objects and both are optional.

* fields: OPTIONAL. Fields within the User object that was retrieved/set during authentication. These fields are expected to be part of a POJSO (Plain Old JavaScript Object) stored as part of getUser() or validatePassword(), and are used in some of the restrictTo* authorization middleware. There are currently two fields:
** fields.id: Property of the User object that contains the user ID. If none is provided, then "id" is used.
** fields.roles: Property of the User object that contains the user roles, as an array of strings. If none is provided, then "roles" is used.
* params: OPTIONAL. Names of params passed as part of the expressjs route, and retrievable as this.params[param]. These params are used as part in some of the restrictTo* authorization middleware. There is currently one field:
** params.id: Param in which the user ID is normally stored, if none is provided, then "user" is used. For example, if params.id === "foo", then the route should have /user/:foo. 

Initialization returns the object that has the restrictTo* middleware.

#### Middleware
As in the example above, once you have authentication and authorization set up and initialized, you may use authorization middleware:

````JavaScript
server.get("/some/route/:user",cansec.restrictToLoggedIn,routeHandler);
server.get("/my/data/:user",cansec.restrictToSelf,routeHandler);
server.get("/admin/:user",cansec.restrictToRoles("admin"),routeHandler);

````

### Unauthorized Errors
cansecurity authorization will never directly return errors. If a restrictTo* middleware is called, and authorization fails, it will call next(error). The error will always be structured as follows:

    next({status: 403, message:"unauthorized"});

Obviously, authentication comes before authorization, and if the user fails to authenticated, you may get a 401 from the authentication section without ever reaching authorization.

It is up to you to make sure that you use expressjs's server.error() handler to correctly handle this error.

### Middleware API 
The following authorization middleware methods are available. Each one is followed by an example.

* restrictToLoggedIn - user must have logged in

````JavaScript
server.get("/some/route/:user",cansec.restrictToLoggedIn,routeHandler);
````

* restrictToSelf - user must have logged in and the user ID in the user object from authentication (fields.id above) must equal some parameter in the URL or body (params.id)

````JavaScript
var cs = require('cansecurity');
cansec = cs.init({
	fields: {id: "userid"},
	params: {id: "user"}
});
// only allow a person to see their own stuff
server.get("/some/route/:user",cansec.restrictToSelf,routeHandler);
// note that the param in the route is ":user", which matches the params.id:"user" in cansec.init()
````

* restrictToRoles - user must have logged in and the user must have in his/her "roles" property (fields.roles) in the user object from authentication one of the named roles (one role as string or multiple in array). Roles argument to the function may be a string or an array of strings.

````JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
server.get("/api/admin",cansec.restrictToRoles("admin"),routeHandler);
server.get("/api/siteadmin",cansec.restrictToRoles(["admin","superadmin"]),routeHandler);
// will require the User object from authentication to have a property "roles", which is an array of strings. If one of the strings is "admin", then /api/admin will be allowed. If one of the roles is "admin" or "superadmin", then /api/siteadmin will be allowed.
````
* restrictToSelfOrRoles - combination of the previous two. Roles argument to the function may be a string or an array of strings.

````JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
server.put("/api/user/:user",cansec.restrictToSelfOrRoles("admin"),routeHandler);
/*
 * Will work if one of the following is true:
 * 1) The logged in user has a property "userid" and it matches exactly the value of the param ":user"; OR
 * 2) The logged in user has a property "roles" which is an array of strings, one of which is "admin"
 */
````

* restrictToParam - user must have logged in and some field in the user object (fields.id) from authentication must equal some parameter in the URL or body (params.id). Param argument to the function may be a string or an array of strings.

````JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
server.put("/api/user/search",cansec.restrictToParam("searchParam"),routeHandler);
/*
 * Will work if the logged in user has a property "userid" (since init() set fields.id to "userid"), and the value of that property matches req.param("searchParam"). 
 * Useful for using parameters in searches.
 */
````
	
* restrictToParamOrRoles - user must have logged in and some field in the user object (fields.id) from authentication must equal some parameter in the URL or body (params.id) *or* user must have a specific role. Param argument and roles argument to the function may each be a string or an array of strings.

````JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
server.put("/api/user/search",cansec.restrictToParamOrRoles("searchParam",["admin","superadmin"]),routeHandler);
server.put("/api/address/search",cansec.restrictToParamOrRoles(["searchParam","addParam"],"admin"),routeHandler);
/*
 * Will work if one of the following is true:
 * 1) the logged in user has a property "userid" (since init() set fields.id to "userid"), and the value of that property matches req.param("searchParam"), or, in the second example, one of "searchParam" or "addParam". 
 * 2) The logged in user has the role, as one of the array of strings of the property "roles", set to "admin" or "superadmin" (for the first example), or "admin" (for the second example).
 */
````

* restrictToField - user must have logged in and some field in the user object (fields.id) from authentication must equal the response to a given callback with a given field or fields parameter.

````JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
server.get("/api/user/search",cansec.restrictToField("owner",getObjectFn),routeHandler);
/*
 * Will call getObjectFn(req,res) to get a regular JavaScript object, and then try to match the requested fields, in the above example "owner", to the ID of the User from authentication. The ID from authentication is user.userid, as given in the init() for fields.id.
 */
````

* restrictToFieldOrRoles - user must have logged in and some field in the user object (fields.id) from authentication must equal the response to a given callback with a given field or fields parameter, *or* the user must have a role or roles.

````JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
server.get("/api/user/search",cansec.restrictToFieldOrRoles("owner","admin",getObjectFn),routeHandler);
/*
* Will call getObjectFn(req,res) to get a regular JavaScript object, and then try to match the requested fields, in the above example "owner", to the ID of the User from authentication. The ID from authentication is user.userid, as given in the init() for fields.id.
 */
server.get("/api/user/search",cansec.restrictToFieldOrRoles(["owner","recipient"],["admin","superadmin"],getOwnerFn),routeHandler);
````

A typical use case for restrictToField and its variant restrictToFieldOrRoles is that you may load an object, and want to restrict its access to the owner of an object. For example, let us assume that you are loading an employee record. For that, restrictToSelf would be fine, since the User ID from authentication is likely to match the ID for requesting the employee record. The following example shows this use case:

````JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
server.get("/api/employee/:user",cansec.restrictToSelfOrRoles("admin"),sendDataFn);
````

However, what if you are retrieving a record whose authorization requirements are not known until it is loaded. For example, you are loading a paystub, whose URL is /api/paystubs/34567. Until you load the paystub, you don't actually know who the owner is. Of course, you might make it accessible only via a more detailed API as /api/employee/12345/paystubs/34567, but let us assume that you need to do it directly, with the first simplified API. Until you load the actual paystubs object, and see that the employee is, indeed, 12345, the one who logged in, you don't know whether or not to show it. The following example describes how to simply implement this use case:

````JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
server.get("/api/employee/:user",cansec.restrictToSelfOrRoles("admin"),sendDataFn);
server.get("/api/paystub/:payid",payStubLoad,cansec.restrictToField("employee",getObjectFn),sendDataFn);
````

In this example, we load the paystub, but do not send it. The paystub object retrieved by payStubLoad looks like this:

````JavaScript
{
	id: "34567",
	employee: "12345",
	date: "2011-01-31",
	amount: "$100"
}
````
This is then stored in the request object. Now getObjectFn can return the same object, which has employee as "12345". This is then matched to User.userid, which will allow it to proceed.

### Why We Need a "get" Function for restrictToField
A common pattern, as shown in the last example above, is to retrieve an object, check it against the user, and then determine whether or not to allow the request to proceed. cansecurity would *love* to be able to just do the check directly. It even knows which field/property to check: "employee". It has two problems, however:

1. It doesn't know where the object is stored. Sure, most use cases store it in the request object somewhere, or possibly the response object, but cansecurity does not want to impose on your application where that is. Thus, it just delegates to you, saying, "give me a function to retrieve the object, if I pass you the request."
2. It doesn't know what the object looks like. It may be a POJSO (Plain Old JavaScript Object), like above, or one that supports that style, like Spine Models. But what if it is something more complex, a function, with special parameters? What if it is a Backbone Model, which requires using getters? By asking your application to provide a function, it completely abstracts out the issue, and says, "whatever, as long as you pass me back a POJSO, I am happy."



