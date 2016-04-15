/*jshint unused:vars */
var express = require('express'), app = express(),  http = require('http'), server,
addr1, addr2,
child1 = require('./example')(),
child2 = require('./example')();

child1.on('listening',()=> {
	addr1 = "http://127.0.0.1:"+child1.address().port+"/";
});
child2.on('listening',()=> {
	addr2 = "http://127.0.0.1:"+child2.address().port+"/";
});


app.use(express.static(__dirname+'/public'));
app.get('/servers.js',function (req,res,next) {
	res.status(200).type("js").send("var APISERVERS=['"+addr1+"','"+addr2+"'];");
});
// start our two independent processes
var server = http.createServer(app).listen(() => {
	var port = server.address().port;
	process.stdout.write("http://127.0.0.1:"+port+"/\n");
});
