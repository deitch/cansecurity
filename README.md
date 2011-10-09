multiwayDB
==========

Overview
--------
multiwaydb is a simple in-memory database that allows basic get/set operations from within the in-memory application, while
allowing simultaneous access over http using RESTful URLs.

This is not intended for production use; at least the author never does. I use it primarily to test data points. I will
load the data in on one end, have my app being tested use the REST API, and then validate the data from directly within the
database.


Direct API
----------
The direct API instantiates the database and loads/sets/gets data.

Install: npm install multiwaydb

Use: var db = require('multiwaydb');

* db.init(path) - initializes the database with data from path. This is loaded *synchronously*, and so blocks until returning.
* db.set(table,key,value,cb) - sets the "table" with key = value, and then executes "cb" asynchronously. 
* db.get(table,key,cb) - gets the value of key in table, and then executes cb asynchronously, passing the value as the argument to cb.
* db.find(table,search,cb) - searches table for records that match "search", and passes the results to cb as the argument. "search" should match the jsql syntax for searchjs package.
* db.del(table,key,cb) - deletes the record of key in table, and then executes cb.
* db.clearTable(table,cb) - clears all of the records in table, and then executes cb.
* db.clear(cb) - clears the entire database, and then executes cb.
* db.listen(port) - instructs the database to listen for REST requests on port.

REST API
--------
The REST API is straightforward, and works as follows.

* GET /table/key - gets the record "key" from "table". Can have multiple keys, separated by commas.
* PUT /table/key - replaces the record "key" from "table" with the body of the http request. Body *must* be valid JSON.
* POST /table - creates a new record in "table" with the body of the http request. Body *must* be valid JSON.
* DELETE /table/key - deletes record "key" from "table".
* GET /table?search={a:1,b:2} - searches in table for records that match the value of "search" parameter. Parameter must be valid JSON that matches the jsql syntax of searchjs package.


Licensing
---------
multiwaydb is released under the MIT License http://www.opensource.org/licenses/mit-license.php

The included sha1 library is thanks to Chris Veness, modified for node, and released under the Creative Commons Attribution License. For full information, see http://www.movable-type.co.uk/scripts/sha1.html