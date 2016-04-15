# cansecurity example

This folder contains a simple express app with cansecurity enabled.

To run:

1. cd to this directory
2. `npm install`
3. `node ./run.js`
4. Note the url returned to console
5. Open a browser to the url, e.g. http://localhost:8776
6. Login using the username and password provided to either server
7. Make a request from either of the 2 servers listed in the browser page


## How It Works
The script `run.js` launches two independent http servers from `example.js`. Each selects a random port to listen with.

When you connect with either, a Web page is sent which lets you login to either and make requests to either.

When you log into the first one (you can pick which, it doesn't matter), you get a JSON Web Token (JWT) you can use to authenticate further against either. Your browser keeps the token in memory, and uses it for all further requests.

With each request, you pick which server to connect to, and make a request. You will see that as long as the token is good, your requests will be authenticated and accepted. As soon as it is not, it will be rejected.


