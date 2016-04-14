# cansecurity

## Overview
cansecurity is your **all-in-one** security library for user authentication management and authorization in node (and specifically expressjs and restify) apps.

You can use use authentication, per-route authorization, and even <u>declarative</u> authorization. You can authenticate against *any* authentication system you like, just provide the interface function.

**As of version 0.7.0, we support both restify and express.**

It's this simple:
    
```Javascript
var express = require('express'), app = express(), cs = require('cansecurity'), cansec = cs.init(/* init params */);
	app.use(cansec.validate);
	app.user(app.router);
		
	// send200 is a shortcut route to send a 200 response
		
	// open route
	app.get("/public",send200);
		
	// only authorized if logged in, or as certain roles, or some combination
	app.get("/secure/loggedin",cansec.restrictToLoggedIn,send200);
	app.get("/secure/user/:user",cansec.restrictToSelf,send200);
	app.get("/secure/roles/admin",cansec.restrictToRoles("admin"),send200);
	app.get("/secure/roles/adminOrSuper",cansec.restrictToRoles(["admin","super"]),send200);
	app.get("/secure/selfOrRoles/:user/admin",cansec.restrictToSelfOrRoles("admin"),send200);
	app.get("/secure/selfOrRoles/:user/adminOrSuper",cansec.restrictToSelfOrRoles(["admin","super"]),send200);
		
	// only authorized if "searchParam" is set to the same value as the user ID field set in cs.init();
	app.get("/secure/param",cansec.restrictToParam("searchParam"),send200);
	app.get("/secure/paramOrRole",cansec.restrictToParamOrRoles("searchParam","admin"),send200);
	app.get("/secure/paramOrMultipleRoles",cansec.restrictToParamOrRoles("searchParam",["admin","super"]),send200);
		
	// only authorized if getCheckObject() returns an object, with field owner, that has a value matching the user ID field
	app.get("/secure/field",cansec.restrictToField("owner",getCheckObject),send200);
	app.get("/secure/fields",cansec.restrictToField(["owner","recipient"],getCheckObject),send200);
	app.get("/secure/fieldOrRole",cansec.restrictToFieldOrRoles("owner","admin",getCheckObject),send200);
	app.get("/secure/fieldOrRoles",cansec.restrictToFieldOrRoles("owner",["admin","super"],getCheckObject),send200);
	app.get("/secure/fieldsOrRole",cansec.restrictToFieldOrRoles(["owner","recipient"],"admin",getCheckObject),send200);
	app.get("/secure/fieldsOrRoles",cansec.restrictToFieldOrRoles(["owner","recipient"],["admin","super"],getCheckObject),send200);
		
	// only authorized if the request parameter "private" has the value "true", and then restrict to logged in
	app.get("/secure/conditionalDirect",cansec.ifParam("private","true").restrictToLoggedIn,send200);
	app.get("/secure/conditionalIndirect",cansec.ifParam("private","true").restrictToRoles(["admin","super"]),send200);
```

And if you prefer declarative authorization, even easier:

```Javascript
// inside app.js:
		
// instantiate the user validator
app.use(cansec.validate);
// instantiate the declarative authorizer
app.use(cansec.authorizer(pathToAuthConfigFile));
		
// inside "pathToAuthConfigFile"
{
	"routes": [
		// [verb,path,default,[test params,] test condition]
		["GET","/api/user","user.roles.admin === true"],
		["GET","/api/user/:user","user.roles.admin === true || user.id === req.param('user')"],
		["GET","/api/user/:user",{"private":"true"},"user.roles.admin === true || user.id === req.param('user')"],
		["PUT","/api/user/:user","user.roles.admin === true || user.id === req.param('user')"],
		["GET","/api/user/:user/roles","user.roles.admin === true || user.id === req.param('user')"],
		["PUT","/api/user/:user/roles","user.roles.admin === true"]
	]	
}
		
```

#### Changes
For any breaking changes, please see the end of this README.

### Authentication
cansecurity will manage your user authentication, including managing stateless sessions. It can use either native express sessions and or its own **stateless** sessions. cansecurity stateless sessions can keep a user logged in automatically across multiple nodejs instances, essentially creating free single-sign-on.

### Authorization
cansecurity will handle authorization in your requests, determining if a user should be allowed to perform a certain request, based on your rules. 

You can tell cansecurity to manage your authorization imperatively (via middleware code) or declaratively (using a config file). Whatever works better for you is just fine for cansecurity!

## Installation
Installation is simple, just install the npm module:

```
npm install cansecurity
```

## Authentication
### Usage
First *initialize* your cansecurity instance, then use its *validation* to validate users.

#### Initialization
To initialize cansecurity, you must first require() it, and then init() it, which will return the middleware you can use:

```JavaScript
var cs = require('cansecurity');
var cansec = cs.init(initConfig);
```

The `initConfig` has six properties:

* `sessionExpiry`: OPTIONAL. Integer in minutes how long sessions should last, default is `15`. Used both for expressjs sessions and CS sessions. Setting `sessionExpiry` will **only** affect how long a session is valid **for cansecurity**. It will **not** affect the underlying expressjs session itself.
* `sessionKey`: OPTIONAL. String. Secret key shared between nodejs servers to provide single-sign-on. This is a string. The default, if none is provided, is a random 64-character string. This is **required** if you want to take advantage of cansecurity's stateless sessions. Keep this very secret.
* `validate`: REQUIRED. Function that will get a user by username, and possibly validate their password, asynchronously. For more details, see below.
* `encryptHeader`: OPTIONAL. With a value of true, the entire JWT is encrypted using `rc4-hmac-md5` algorithm.
* `authHeader`: OPTIONAL. Replaces the header `X-CS-Auth` in which the server sends its token and user information back to the requestor/browser with the specified header name. `X-CS-Auth` is used *only* for sending the request from the server to the requestor (browser). The request to the server *always* is `Authentication`.
* `debug`: OPTIONAL. Print debug messages about each authentication attempt to the console. It will **not** include the actual password.

#### Validation
Validation is straightforward. Once you have set up cansecurity properly, it functions as standard expressjs middleware:

```Javascript
app.use(cansec.validate);
app.use(app.router);
```

This should be done **before** your router.

If the user is successfully authenticated, then the user object will be placed in two locations:

```Javascript
req["X-CS-Auth"];
req.session["X-CS-AUTH"].user;  // only if expressjs sessions have been enabled
```

However, for safety, you should retrieve it using the convenience method:

```JavaScript

require('cansecurity').getUser(req);
// or simply
cs.getUser(req);
```

You can also determine *how* the current user was authorized, credentials (e.g. password) and token, by calling 

```JavaScript
require('cansecurity').getAuthMethod(req);
// returns "credentials" or "token"
// or simply
cs.getAuthMethod(req);
```

This is very useful in cases when you need the existing password for an action. A common use case is changing a password or setting security parameters. You might be fine with the user logging in via token for most actions (happens all the time when you go back to Facebook or Twitter from the same browser as last time), but if they want to change their password, they need to send the password again (try changing your Facebook or Gmail password, or Gmail two-factor autnentication).


### Required Options
The **only** required option to `cs.init()` is the function to allow cansecurity to get a user from your system: `validate()`.

Must have the following signature

```Javascript
validate(username,password,callback);
```

The `validate()` function is expected to retrieve user information from your preferred user store. It *may* validate a password for the user as well, and indicate to the callback if it succeeded or failed. The signature and expected parameters to the callback are as follows:

```Javascript
callback(success,user,message);
```

Where:
  `success`: boolean, if we succeeded in retrieving the user and, if requested, validating password credentials
	`user`: the actual user object. This can be a function, a JavaScript object, anything you want. It will be placed inside the session and the request for you to use later. If retrieval/validation was successful, this must not be null/undefined.
	`message` = the error message in case of retrieval/validation failure. This can be anything you want, and will be passed along with the 401 unauthenticated response. 

If the user was already authenticated via session, token or some other method, then `validateUser()` will be called with `password` parameter set to `undefined`. If `password` is set to **anything** other than `undefined` (including a blank string), then `validateUser()` is expected to validate the password along with retrieving the user.

```JavaScript
cansec.init({
	validate: function(username,password,callback) {
		if (password !== undefined) {
			// validate the username and password, then retrieve the user credentials
		} else {
			// just retrieve the user credentials
		}
	}
});
````

### Unauthenticated Errors
When authentication fails, cansecurity will directly return 401 with the message "unauthenticated". 

* If authentication is required and succeeds, it will set request["X-CS-Auth"], and request.session["X-CS-Auth"] if sessions are enabled, and then call next() to jump to the next middleware. 
* If authentication is required and fails, it will return `401` with the text message `unauthenticated`
* If authentication is **not** required, it will jump to the next middleware 

If the user has provided HTTP Basic Authentication credentials in the form of username/password **and** the authentication via `validate()` fails. In that case, cansecurity will return a `401`.


### How Authentication Works
With each request, the following algorithm is followed:

1. Was there an HTTP Basic `Authentication` header? If so, validate using the credentials. If they succeed, the user is authenticated, else send back a `401` unauthenticated and include a response X-CS-Auth header of `"error invalidpass"`. If not, go to the next step.
2. Was there an HTTP Bearer `Authentication` header? If so, validate the JSON Web Token using the auth header. If they succeed, the user is authenticated, else they are not and return a `401` with `error=invalidtoken`. If not, go to the next step.
3. Is there a valid and non-expired expressjs session? If so, the user is authenticated. If not, go to the next step.
4. The user is not authenticated.

Note that failing to get an authentication for all of the above steps does **not** necessarily indicate that a 401 should be sent back. It is entirely possible that the user is accessing a resource that does not require authentication! This part of the cansecurity library is entirely about authentication; authorization is a different topic.

To summarize:

* Passing credentials in an `Authentication` header (`Bearer` with JWT or `Basic` with username/password) that fail, **always** will return a `401`.
* Passing no credentials but with a valid expressjs session will pass the request with the user as authenticated to the app.
* Passing no credentials with no valid expressjs sessions will pass the request with the user as unauthenticated to the app.

### HTTP Headers

#### HTTP Response Header
cansecurity passes details about success or failure of authentication in the custom `X-CS-Auth` HTTP response header. Of course, a failed authentication will return a `401`, but the *reason* for failure will be in the appropriate header listed in this section. Similarly, a successful authentication - by *any* means - will allow the request to go through returning a `200`, `201`, `403`, `404`, etc., depending on the app. cansecurity *will*, however, return the session token and logged in user via the `X-CS-Auth` HTTP response header.

The `X-CS-Auth` response header contains error responses or success tokens. 

##### Success

A successful authentication provides the following format:

```
success token username expiry
```

Where:
	`success`: result of the authentication, either `success` or `error`
	`token`: a JSON Web token if `success`, or an error message if `error`
	`username`: the user's username if `success`
	`expiry`: when this token will expire, as a JavaScript (Unix) second timestamp, provided by `Math.floor(new Date().getTime()/1000)`

Because a new token is created anew with each request, the expiry window is rolling - x minutes from the last valid request.

Both the `username` and `expiry` are convenience methods. They are contained within the JSON Web Token provided in the response.

The JWT payload contains the following fields:

* `sub`: the subject of the JWT. This is identical to the `username` field in the header response.
* `exp`: the expiry of the token. This is identical to the `expiry` field in the header response.
* `cs-user`: the actual logged in user when authentication by any means was successful. 


The `cs-user` is a "JST private claim". Normally, it is a JSON-encoded string, but it really depends on what your `validate()` function returns in the `user` parameter of the `callback`.

**Note**: You need to be **really** careful with what `validate()` returns. *Everything* in there goes into the `cs-user` field in the JWT. While it only goes in the header to the authenticated user, it still is sending out everything you send. You might not want the password - even hashed - in the header fields.


##### Failure
A failed authentication provides the following format:

```
error message
```

Where:
	`result`: result of the authentication, either `success` or `error`
	`message`: the error message, if any



#### CORS
Note for usage in CORS situations. cansecurity automatically adds the following header to every response:

```
Access-Control-Expose-Headers: X-CS-Auth
```

Of course, it does so intelligently, so it adds it to an existing list of headers (does not trounce them) or creates it.

### Performance
Extensive performance testing has not been done. However, all of the algorithms are symmetric, which are very high-performance. The expensive part is validate(), which may require your app to look in a data source or database. However, since the majority of requests will simply hit the local session, the user will be stored locally, and it is not an issue. The hit will only be for the first authentication for each user, as well as when a user switches between nodejs servers using cansecurity stateless sessions.

### Example
For a good example, see the test suite in test/test.js, specifically the section beginning cansec.init. It is reproduced below:

```JavaScript
var express = require('express'), app = express(), cs = require('cansecurity'), cansec,
// static database for testing
user = {name:"john",pass:"1234",age:25};

cansec = cs.init({
	validate: function(login,password,callback){
		if (user.name !== login) {
			// no such user - ERROR
			callback(false,null,"invaliduser");
		} else if (password === undefined) {
			// never asked to check a password, just send the user - GOOD
	    callback(true,user,user.name);
		} else if (user.pass !== pass) {
			// asked to check password, but it didn't match - ERROR
			callback(false,null,"invalidpass");
		} else {
			// user matches, password matches - GOOD
			callback(true,user,user.name);
		}
	},
	sessionKey: SESSIONKEY
});


app.configure(function(){
	app.use(express.cookieParser());	
	app.use(express.session({secret: "agf67dchkQ!"}));
	app.use(cansec.validate);
	app.use(function(req,res,next){
		// send a 200
		sendResponse(req,res,200);
	});
});
app.user(function(err,req,res,next){
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
app.listen(PORT);
```

## Authorization
Authorization is the process of checking if a user is **allowed** to perform a certain action (in our case, execute a certain route), assuming they have already been authenticated (or not).

cansecurity can do authorization as route-specific middleware (imperative) or via a config file (declarative).

cansecurity authorization also includes conditionals, allowing the authorization to be applied only if certain parameters are met.

### Middleware Authorization
This is the traditional express usage: declare a route, chain up some middleware functions. The easiest way to demonstrate this is with an example, following which we will describe all of the options and APIs.

```JavaScript
express = require('express'),
cansec = require('cansecurity').init({});
server = express.createServer();
// do lots of server initialization
app.get("/some/route/:user",cansec.restrictToLoggedIn,routeHandler);
app.get("/some/route",cansec.ifParam("private","true").restrictToRoles("admin"),routeHandler);

```

#### Usage
Usage of cansecurity authorization is only possible if you are using cansecurity authentication as well. To use authorization, you do two steps: initialization and middleware.

##### Initialization
The authorization component of cansecurity is initialized at the same time as the authentication component:

```JavaScript
var cs = require('cansecurity'), cansec;
cansec = cs.init({});
```

or more simply:

```JavaScript
var cansec = require('cansecurity').init({});
```

In initialization, you set two key authorization parameters as properties of the config object passed to cs.init(). Both are objects and both are optional.

* fields: OPTIONAL. Fields within the User object that was retrieved/set during authentication. These fields are expected to be part of a POJSO (Plain Old JavaScript Object) stored as part of validate(), and are used in some of the restrictTo* authorization middleware. There are currently two fields:
* * fields.id: Property of the User object that contains the user ID. OPTIONAL. Defaults to "id"
* * fields.roles: Property of the User object that contains the user roles, as an array of strings. OPTIONAL. Defaults to "roles"
* params: OPTIONAL. Names of params passed as part of the expressjs route, and retrievable as this.params[param]. These params are used as part in some of the restrictTo* authorization middleware. There is currently one field:
* * params.id: Param in which the user ID is normally stored, if none is provided, then "user" is used. For example, if params.id === "foo", then the route should have /user/:foo. 

Initialization returns the object that has the restrictTo* middleware.

##### Middleware
As in the example above, once you have authentication and authorization set up and initialized, you may use authorization middleware:

```JavaScript
// execute routeHandler() if user is logged in, else send 401
app.get("/some/route/:user",cansec.restrictToLoggedIn,routeHandler); 
// execute routeHandler if req.param("user") === user[fields.id], where 'user' is as returned by validate(), else send 401
app.get("/my/data/:user",cansec.restrictToSelf,routeHandler);
// execute routeHandler if user[fields.roles] contains "admin", where 'user' is as returned by validate(), else send 401
app.get("/admin/:user",cansec.restrictToRoles("admin"),routeHandler);
// execute routeHandler if one of:
//     req.param("secret") === "false"
//     req.param("secret") === "true" && user[fields.roles] contains "admin"
app.get("/user",cansec.ifParam("secret","true").restrictToRoles("admin"),routeHandler);

```

#### Unauthorized Errors
cansecurity authorization will directly return a `403` and message `unauthorized` if authorization is required, i.e. a restrictTo* middleware is called, **and** fails. 

Obviously, authentication comes before authorization, and if the user fails to authenticate, you may get a 401 from the authentication section without ever trying authorization.

#### Middleware API 
The following authorization middleware methods are available. Each one is followed by an example. There are two sections

* Regular API: Regular restrictTo* that are always applied.
* Conditional API: Conditions under which to apply the regular restrictTo* interfaces.

##### Regular API
Regular API interfaces are used to restrict access, each example is given below.

* restrictToLoggedIn - user must have logged in

```JavaScript
app.get("/some/route/:user",cansec.restrictToLoggedIn,routeHandler);
```

* restrictToSelf - user must have logged in and the user ID in the user object from authentication (fields.id above) must equal some parameter in the URL or body (params.id)

```JavaScript
var cs = require('cansecurity');
cansec = cs.init({
	fields: {id: "userid"},
	params: {id: "user"}
});
// only allow a person to see their own stuff
app.get("/some/route/:user",cansec.restrictToSelf,routeHandler);
// note that the param in the route is ":user", which matches the params.id:"user" in cansec.init()
```

* restrictToRoles - user must have logged in and the user must have in his/her "roles" property (fields.roles) in the user object from authentication one of the named roles (one role as string or multiple in array). Roles argument to the function may be a string or an array of strings.

```JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
app.get("/api/admin",cansec.restrictToRoles("admin"),routeHandler);
app.get("/api/siteadmin",cansec.restrictToRoles(["admin","superadmin"]),routeHandler);
// will require the User object from authentication to have a property "roles", which is an array of strings. If one of the strings is "admin", then /api/admin will be allowed. If one of the roles is "admin" or "superadmin", then /api/siteadmin will be allowed.
````
* restrictToSelfOrRoles - combination of the previous two. Roles argument to the function may be a string or an array of strings.

```JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
app.put("/api/user/:user",cansec.restrictToSelfOrRoles("admin"),routeHandler);
/*
 * Will work if one of the following is true:
 * 1) The logged in user has a property "userid" and it matches exactly the value of the param ":user"; OR
 * 2) The logged in user has a property "roles" which is an array of strings, one of which is "admin"
 */
```

* restrictToParam - user must have logged in and some field in the user object (fields.id) from authentication must equal some parameter in the URL or body (params.id). Param argument to the function may be a string or an array of strings.

```JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
app.put("/api/user/search",cansec.restrictToParam("searchParam"),routeHandler);
/*
 * Will work if the logged in user has a property "userid" (since init() set fields.id to "userid"), and the value of that property matches req.param("searchParam"). 
 * Useful for using parameters in searches.
 */
```
	
* restrictToParamOrRoles - user must have logged in and some field in the user object (fields.id) from authentication must equal some parameter in the URL or body (params.id) *or* user must have a specific role. Param argument and roles argument to the function may each be a string or an array of strings.

```JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
app.put("/api/user/search",cansec.restrictToParamOrRoles("searchParam",["admin","superadmin"]),routeHandler);
app.put("/api/address/search",cansec.restrictToParamOrRoles(["searchParam","addParam"],"admin"),routeHandler);
/*
 * Will work if one of the following is true:
 * 1) the logged in user has a property "userid" (since init() set fields.id to "userid"), and the value of that property matches req.param("searchParam"), or, in the second example, one of "searchParam" or "addParam". 
 * 2) The logged in user has the role, as one of the array of strings of the property "roles", set to "admin" or "superadmin" (for the first example), or "admin" (for the second example).
 */
```

* restrictToField - user must have logged in and some field in the user object (fields.id) from authentication must equal the response to a given callback with a given field or fields parameter.

```JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
app.get("/api/user/search",cansec.restrictToField("owner",getObjectFn),routeHandler);
/*
 * Will call getObjectFn(req,res) to get a regular JavaScript object, and then try to match the requested fields, in the above example "owner", to the ID of the User from authentication. The ID from authentication is user.userid, as given in the init() for fields.id.
 */
```

* restrictToFieldOrRoles - user must have logged in and some field in the user object (fields.id) from authentication must equal the response to a given callback with a given field or fields parameter, *or* the user must have a role or roles.

```JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
app.get("/api/user/search",cansec.restrictToFieldOrRoles("owner","admin",getObjectFn),routeHandler);
/*
* Will call getObjectFn(req,res) to get a regular JavaScript object, and then try to match the requested fields, in the above example "owner", to the ID of the User from authentication. The ID from authentication is user.userid, as given in the init() for fields.id.
 */
app.get("/api/user/search",cansec.restrictToFieldOrRoles(["owner","recipient"],["admin","superadmin"],getOwnerFn),routeHandler);
```

A typical use case for restrictToField and its variant restrictToFieldOrRoles is that you may load an object, and want to restrict its access to the owner of an object. For example, let us assume that you are loading an employee record. For that, restrictToSelf would be fine, since the User ID from authentication is likely to match the ID for requesting the employee record. The following example shows this use case:

```JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
app.get("/api/employee/:user",cansec.restrictToSelfOrRoles("admin"),sendDataFn);
```

However, what if you are retrieving a record whose authorization requirements are not known until it is loaded. For example, you are loading a paystub, whose URL is /api/paystubs/34567. Until you load the paystub, you don't actually know who the owner is. Of course, you might make it accessible only via a more detailed API as /api/employee/12345/paystubs/34567, but let us assume that you need to do it directly, with the first simplified API. Until you load the actual paystubs object, and see that the employee is, indeed, 12345, the one who logged in, you don't know whether or not to show it. The following example describes how to simply implement this use case:

```JavaScript
var cansec = require('cansecurity').init({
	fields: {id: "userid", roles:"roles"},
	params: {id: "user"}
});
app.get("/api/employee/:user",cansec.restrictToSelfOrRoles("admin"),sendDataFn);
app.get("/api/paystub/:payid",payStubLoad,cansec.restrictToField("employee",getObjectFn),sendDataFn);
```

In this example, we load the paystub, but do not send it. The paystub object retrieved by payStubLoad looks like this:

```JavaScript
{
	id: "34567",
	employee: "12345",
	date: "2011-01-31",
	amount: "$100"
}
```
This is then stored in the request object. Now getObjectFn can return the same object, which has employee as "12345". This is then matched to User.userid, which will allow it to proceed.

##### Conditional API

The conditional API simply creates conditions under which the regular restrictions are applied. If the conditions are not met, then restrictions are not applied.

* ifParam - apply the restriction only if a certain parameter matches a certain value.

What if you have a resource that is normally accessible by all, but if certain parameters are applied, e.g. ?secret=true, then it should be restricted to an admin?

```JavaScript
app.get("/api/employee",cansec.ifParameter("secret","true").restrictToRoles("admin"),sendDataFn);
```

In the above example, anyone can do a GET on /api/employee, but if they pass the parameter ?secret=true, then they will have to be logged in and have the role "admin" defined. 

In our example, sendDataFn also checks for that parameter. If it is not set, then it sends public data about the employee list; if it is set, it sends public and private data, trusting that cansecurity prevented someone from getting in with ?secret=true unless they are authorized.


#### Why We Need a "get" Function for restrictToField
A common pattern, as shown in the last example above, is to retrieve an object, check it against the user, and then determine whether or not to allow the request to proceed. cansecurity would *love* to be able to just do the check directly. It even knows which field/property to check: "employee". It has two problems, however:

1. It doesn't know where the object is stored. Sure, most use cases store it in the request object somewhere, or possibly the response object, but cansecurity does not want to impose on your application where that is. Thus, it just delegates to you, saying, "give me a function to retrieve the object, if I pass you the request."
2. It doesn't know what the object looks like. It may be a POJSO (Plain Old JavaScript Object), like above, or one that supports that style, like Spine Models. But what if it is something more complex, a function, with special parameters? What if it is a Backbone Model, which requires using getters? By asking your application to provide a function, it completely abstracts out the issue, and says, "whatever, as long as you pass me back a POJSO, I am happy."

#### Clearing session data
The function to clear is exposed once Cansecurity is initialized.

```javascript
app.get("/logout",function(req, res){
	cansec.clear(req, res);
	res.send(200);
});
```

#### Deny All
If you want to deny access to everything - always send a 403 - unless it is *explicitly* approved, just add a "deny all" line at the end of your routes.

```JavaScript
app.get("/api/employee/:user",cansec.restrictToSelfOrRoles("admin"),sendDataFn);
app.get("/public/page",send200);
// lots more 
app.get("*",function(req,res,next){res.send(403);});
```

### Declarative Authorization
Declarative authorization is given to drastically clean up your authorizations. Normal cansecurity authorization lets you inject authorization into every route, like so.

```JavaScript
app.get("/secure/loggedin",cansec.restrictToLoggedIn,send200);
app.get("/secure/user/:user",cansec.restrictToSelf,send200);
app.get("/secure/roles/admin",cansec.restrictToRoles("admin"),send200);
app.get("/secure/roles/adminOrSuper",cansec.restrictToRoles(["admin","super"]),send200);
app.get("/secure/selfOrRoles/:user/admin",cansec.restrictToSelfOrRoles("admin"),send200);
app.get("/secure/selfOrRoles/:user/adminOrSuper",cansec.restrictToSelfOrRoles(["admin","super"]),send200);

// only authorized if "searchParam" is set to the same value as the user ID field set in cs.init();
app.get("/secure/param",cansec.restrictToParam("searchParam"),send200);
app.get("/secure/paramOrRole",cansec.restrictToParamOrRoles("searchParam","admin"),send200);
app.get("/secure/paramOrMultipleRoles",cansec.restrictToParamOrRoles("searchParam",["admin","super"]),send200);

// only authorized if getCheckObject() returns an object, with field owner, that has a value matching the user ID field
app.get("/secure/field",cansec.restrictToField("owner",getCheckObject),send200);
app.get("/secure/fields",cansec.restrictToField(["owner","recipient"],getCheckObject),send200);
app.get("/secure/fieldOrRole",cansec.restrictToFieldOrRoles("owner","admin",getCheckObject),send200);
app.get("/secure/fieldOrRoles",cansec.restrictToFieldOrRoles("owner",["admin","super"],getCheckObject),send200);
app.get("/secure/fieldsOrRole",cansec.restrictToFieldOrRoles(["owner","recipient"],"admin",getCheckObject),send200);
app.get("/secure/fieldsOrRoles",cansec.restrictToFieldOrRoles(["owner","recipient"],["admin","super"],getCheckObject),send200);

// only authorized if the request parameter "private" has the value "true", and then restrict to logged in
app.get("/secure/conditionalDirect",cansec.ifParam("private","true").restrictToLoggedIn,send200);
app.get("/secure/conditionalIndirect",cansec.ifParam("private","true").restrictToRoles(["admin","super"]),send200);
```

This is worlds better than before, when authorization was one of:

* didn't exist
* stuck *inside* the routes (really bad for separation of concerns, leading to unmaintainable code)
* binary, logged in or out but nothing more fine-tuned than that

But it still requires lots of code in the routes. What if you could just declare in a config file what authorization rules you want?

```JavaScript
{
	"routes": [
	  // [verb,path,[test params,][require logged in],[loader,]test condition]
		["GET","/api/user",true,"user.roles.admin === true"],
		["GET","/api/user/:user","user.roles.admin === true || user.id === req.param('user')"],
		["GET","/api/user/:user",{"private":"true"},true,"user.roles.admin === true || user.id === req.param('user')"],
		["PUT","/api/user/:user","user.roles.admin === true || user.id === req.param('user')"],
		["GET","/api/user/:user/roles","user.roles.admin === true || user.id === req.param('user')"],
		["PUT","/api/user/:user/roles","user.roles.admin === true"]
	]	
}
```

cansecurity provides you precisely this ability!

#### Usage
To use declarative authorization, you take two steps:

1. Set up the config file
2. `app.use(cansec.authorizer(pathToConfigFile,options))`

#### Config File
The config file is a simple `json` file. You can name it whatever you want. The file should be a single object, with one key, `routes`, which is an array of arrays.

```JavaScript
{
	routes:[
	  [/* route 1 */],
	  [/* route 2 */],
		/* ... */
	  [/* route n */]
	]
}
```

Each route is an array of 4 or 5 parts, as follows:

```
[verb,route,[params,][loggedIn,][loader,]condition]
```

* verb: string, one of GET PUT POST DELETE, and is case-insensitive
* route: string, an express-js compatible route, e.g. "/api/user/:user" or "/post/:post/comment/:comment". Note that ".:format?" is optional. See "format" later.
* params: optional object, which will be checked to match the route, e.g. `{private:true}` or `{secret:"true",name:"foo"}`. If the params match, then the route will be applied, else this route is considered to *not* match and will be ignored. See the examples below and the tests.
* loggedIn: optional boolean. If true, user **must** be logged in via cansecurity **before** checking authorization. If the user is not logged in, send `401`.
* loader: name of a loader in your initializer that should run when the verb/route/params/loggedIn are matched, but before testing the condition
* condition: JavaScript string which should return a condition. If true, then do the opposite of the default behaviour

Here are some examples.

```JavaScript
// when GET /api/user, send 403 unless user.roles.admin === true
["GET","/api/user","user.roles.admin === true"],

// when GET /api/user, if not logged in, send 401; if logged in send 403 unless user.roles.admin === true
["GET","/api/user",true,"user.roles.admin === true"],

// when GET /api/user/:user, send 403 unless user.roles.admin === true, OR user.id === req.param('user')
["GET","/api/user/:user","user.roles.admin === true || user.id === req.param('user')"],

// when GET /api/user/:user AND ?private=true (or in the body), send 403 unless user.roles.admin === true || user.id === req.param('user')
//     if private !== true (or is unset or anything else), then this rule is not applied, and access is allowed
["GET","/api/user/:user",{"private":"true"},"user.roles.admin === true || user.id === req.param('user')"],

// same as previous example, but send 401 if !logged in, then continue from previous example
["GET","/api/user/:user",{"private":"true"},true,"user.roles.admin === true || user.id === req.param('user')"],

// when PUT /api/user/:user, send 403 unless user.roles.admin === true || user.id === req.param('user')
["PUT","/api/user/:user","user.roles.admin === true || user.id === req.param('user')"],

// when GET /api/user/:user/roles, send 403 unless user.roles.admin === true || user.id === req.param('user')
["GET","/api/user/:user/roles","user.roles.admin === true || user.id === req.param('user')"],

// when PUT /api/user/:user/roles, send 403 unless user.roles.admin === true
["PUT","/api/user/:user/roles","user.roles.admin === true"]

// when PUT /api/user/:user/roles, run the "roles" loader, then send 403 unless user.roles.admin === true || item.name === 'me'
["PUT","/api/user/:user/roles","roles","(user.roles.admin === true) || (item.name === 'me')"]
```

#### Deny All
If you want to deny access to everything - always send a 403 - unless it is *explicitly* approved, just add a "deny all" line at the end of your declarative routes.

```JavaScript
// when PUT /api/user/:user/roles, send 403 unless user.roles.admin === true
["PUT","/api/user/:user/roles","user.roles.admin === true"]

// when PUT /api/user/:user/roles, run the "roles" loader, then send 403 unless user.roles.admin === true || item.name === 'me'
["PUT","/api/user/:user/roles","roles","(user.roles.admin === true) || (item.name === 'me')"]

// deny everything else
["GET","*","false"]
```


#### Context for the Condition
The condition string is run inside its own new context. Besides the usual nodejs environment, it has the following variable available to it:

1. `req`: the actual express `req` object, normally found on each route whose signature is `function(req,res,next)`. 
2. `request`: an alias for `req`
3. `user`: the user object if you used cansecurity authentication. This is the equivalent of calling `cansec.getUser(req)`.
4. `_`: the underscore/lodash utility functions. cansecurity actually uses [lodash](http://lodash.com)
5. `item`: the item loaded, if any, by the loader functions passed to `cansec.init()`; see below.

#### Loading Data
You have the option, but not the requirement, to load data before passing your route through the declarative authorizer. 


Each loader function has two simple jobs to do:

1. Load relevant data into `req.cansecurity.item`
2. Call `next`

`req.cansecurity` will already be available as an object. `item` can be an object, a string, an array, null, undefined, boolean, or anything at all that you want to pass to your conditions.

The full suite of `request`, `response` and `next` methods is available. Thus, you could easily call `res.send(400)` if you have an error and do not wish to proceed, or perhaps `next(error)`. Similarly, `req.param(someParam)` is also available.

Here is an example:

```JavaScript
cansec.init({
	loader: {
		group: function(req,res,next) {
			models.group.find(someParam,function(err,data){
				req.cansecurity.item = data;
				next();
			});
		}
	}
});
```

And the declarative:

```JavaScript
{
	routes: [
		["GET","/api/group/:group",true,"group","_.contains(item.members,user.id)"]
	]
}
```


**Note:** Any route where login is required, login will be validated *before* running the loader.

So where do you actually define the loader functions? You have two options for where the loader can exist.

##### Global
If you have or want a single loader, you can pass all of your loader functions into `cansec.init()`:

```JavaScript
cansec.init({
	loader:  {
		user: function(req,res,next) {
		},
		group: function(req,res,next) {
		}
	}
});
```

And the declarative part:

```JavaScript
{
	routes: [
		["GET","/api/group/:group",true,"group","_.contains(item.members,user.id)"]
	]
}
```

##### Local
You can define the loader functions in a file local to a certain declarative file:

```JavaScript
// in your main server.js
app.use(cansec.authorizer(__dirname+'/path/to/decl.json',{loader: {
	fn1: function(req,res,next){},
	fn2: function(req,res,next){} 
}}))
```

Of course, you can always separate the loader functions into another file, like with the init file, and `require` it yourself:

```JavaScript
// in your main server.js
app.use(cansec.authorizer(__dirname+'/path/to/decl.json',{loader: require(pathToLoader)}))
```

If you can do it globally, why bother with the local? Simple. You can have *multiple* declarative files. For example, we often separate the security authorization (user Jim is allowed to see his own account) from subscription authorization (user Jim already has 2 accounts and needs to upgrade his plan to get another).

```JavaScript
// in your main server.js
app.use(cansec.authorizer(__dirname+'/path/to/security.json',{loader:securityConfig}))
app.use(cansec.authorizer(__dirname+'/path/to/plans.json',{loader:plansConfig}))
```

If course, you might want to keep them together, in which case just use the global!


##### Order of Priority

What if a particular loader is defined in *both* lcala *and* global? The order of priority then is:

1. Look for and run the loader in the local; if not found...
2. Look for an run the loader in the global.

Simple, right?



#### What It Returns
The authorizer has one of three possible results:

* Send `401` if authentication is required and the user is not logged in
* Send `403` if the route matches the condition fails
* `next()`

The logic is as follows:

1. Does the route match? If not, `next()`; else
2. Does the route require authentication? If yes and the user is not logged in, send `401`; else
3. Does the condition evaluate to `true` and not have any errors? If not, send `403`; else
4. `next()`


#### Use the authorizer
Simple:

```javascript
app.use(cansec.authorizer(pathToConfigFile,options));
app.use(app.router);
```

Done!


#### Path Format
Many REST paths use a "format" extension. In express, it usually looks like this:

```JavaScript
app.get("/api/user/:user.:format?",fn);
```

This allows express to handle both `/api/user/10` and `/api/user/10.json`.

cansecurity's declarative authorization *can* handle `.:format?` just by putting it in the path:

```javascript
["GET","/api/user/:user.:format?",{"private":"true"},true,"user.roles.admin === true || user.id === req.param('user')"],
```

But that can get tedious, if you have a lot of routes. To simplify things, one of the options when setting it up is `{format:true}` as follows:

```JavaScript
app.use(cansec.authorizer(pathToConfigFile,{format:true}));
```

If `format` is set to `true`, then cansecurity will *automatically* add `.:format?` to every path that does not end in `.:format?` already, or in `/`.


## Testing
To run the tests, from the root directory, run `npm test`.

**Note:** Tests are set up both for express and for restify. However, running them both causes one to trounce the other. Apparently restify grabs hold of the http module and its server munges the requests that express tries to read. One cannot really blame restify; it never intended to run in the same node instance with another server.

To bypass this issue, run tests *twice*:

```
mocha -g '(?:restify)'
mocha -g restify
```

`npm` is set up to do precisely this for you, if you run `npm test`.


## Breaking Changes

#### Changes to version 2.0.0
2.0.0 is a major release with many breaking changes. 

##### JWT instead of multiple headers
The `X-CS-Auth` header is deprecated from requests. All credentials should be passed in the `Authentication` header, either `Basic` for user/pass authentication, or `Bearer` for a JSON Web Token that was generated by cansecurity.

The `X-CS-User` header is deprecated from responses. All of the user information is now held as a field of the returned JWT.

* Response: `X-CS-User` contains the status and JWT, which includes the user information.
* Request: `Authorization` contains the credentials, either user/pass or JWT.

##### Separation of fields by space instead of colon
In a successful response, the fields are separated by whitespace instead of `:`:

    X-CS-Auth: success token username expiry

Instead of

    X-CS-Auth: success=token:username:expiry

##### Expiry in seconds instead of milliseconds
In keeping with the JWT standard, the expiry field - both in the header and in the JWT - are given in timestamp seconds since epoch, instead of milliseconds.

#### Changes to version 1.0.0
Express 4 support!

* All cansecurity versions < 1.0.0 support **only** express < 4.0.0
* All cansecurity versions >= 1.0.0 support **only** express >= 4.0.0

#### Changes to version 0.7.0
restify is now fully supported and tested for. However, restify 2.8.0 or higher is required.

Additionally, because the tests trounce each other, run each separately when testing:

```
mocha -g express
mocha -g restify
```		


#### Changes to version 0.6.4
Declarative authorization no longer has an option to "allow" or "deny" by default. **All** rules are "deny" unless the condition passes. It is very easy to invert the condition and make it pass except in certain circumstances.

```javascript
["GET","/secure/path",true,"allow","a === b"]
```

Can just as easily be written as

```javascript
["GET","/secure/path",true,"deny","a !== b"]
```
Or more simply

````javascript
["GET","/secure/path",true,"a !== b"]
````

#### Changes to version 0.6.0
Prior to version 0.6.0, cansecurity *sometimes* would send back a 401 or 403 as `res.send(401,"unauthenticated")` or `res.send(403,"unauthorized")`, and sometimes would just call `next({status:401,message:"unauthenticated"})` or `next({status:403,message:"unauthorized"})`.

Beginnign with version 0.6.0, cansecurity will **always** return 401 if authentication is required and not present / fails, and will **always** return a 403 if authorization is required and fails.

This makes the results far more consistent.

#### Changes to version 0.5.0
These notes apply to anyone using cansecurity *prior* to v0.5.0. These changes may be breaking, so read carefully. 

##### express 3.x required
Prior to version 0.5.0 (and preferably prior to 0.4.8), cansecurity worked with express 2.x and 3.x, although the full testing regimen worked properly only in express 2.x. Beginning with 0.5.0, only express 3.x will work.

##### validatePassword and getUser consolidated into 
In versions of cansecurity prior to 0.5.0, there were two functions passed to `init()`:

* `validatePassword()` was called when the user authenticated with credentials to be checked.
* `getUser()` was called when the user was authenticated *already* using a token or session, and we just needed the user object.

As of version 0.5.0, these are consolidated into a single `validate()` function. Please check the documentation below.

Until version 1.0 of cansecurity, the legacy functions will continue to operate, if deprecated, under the following circumstances:

    IF `validate()` is `undefined`, AND (`validatePassword()` and `getUser()`) are present, THEN cansecurity will use the old API. 

		IF `validate()` is defined, THEN (`validatePassword()` and `getUser()`) will be ignored, whether present or not.

Beginning with cansecurity 1.0, the old API will not function at all.

