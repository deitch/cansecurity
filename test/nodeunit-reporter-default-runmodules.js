/*jslint node:true, nomen:false */
/**
 * Module dependencies
 */

var nodeunit = require('nodeunit'),
    utils = nodeunit.utils,
    fs = require('fs'),
    track = require('nodeunit/lib/track'),
    path = require('path'),
    AssertionError = nodeunit.assert.AssertionError,
	exports = module.exports;

/**
 * Reporter info string
 */

exports.info = "Default tests reporter";


/**
 * Run all tests within each module, reporting the results to the command-line.
 *
 * @param {Array} files
 * @api public
 */

exports.run = function (files, options) {
	var error, ok, bold, assertion_message, content, start, tracker, opts, names, i, paths, formats = {}, defaultFormats;
	
	options = options || {};
    defaultFormats = {
	    "error_prefix": "\u001B[31m",
	    "error_suffix": "\u001B[39m",
	    "ok_prefix": "\u001B[32m",
	    "ok_suffix": "\u001B[39m",
	    "bold_prefix": "\u001B[1m",
	    "bold_suffix": "\u001B[22m",
	    "assertion_prefix": "\u001B[35m",
	    "assertion_suffix": "\u001B[39m"
	};
	for (i in defaultFormats) {
		if (defaultFormats.hasOwnProperty(i)) {
			formats[i] = options[i] || defaultFormats[i];
		}
	}
	

    error = function (str) {
        return formats.error_prefix + str + formats.error_suffix;
    };
    ok    = function (str) {
        return formats.ok_prefix + str + formats.ok_suffix;
    };
    bold  = function (str) {
        return formats.bold_prefix + str + formats.bold_suffix;
    };
    assertion_message = function (str) {
        return formats.assertion_prefix + str + formats.assertion_suffix;
    };

    start = new Date().getTime();
    tracker = track.createTracker(function (tracker) {
        if (tracker.unfinished()) {
            console.log('');
            console.log(error(bold(
                'FAILURES: Undone tests (or their setups/teardowns): '
            )));
            names = tracker.names();
            for (i = 0; i < names.length; i += 1) {
                console.log('- ' + names[i]);
            }
            console.log('');
            console.log('To fix this, make sure all tests call test.done()');
            process.reallyExit(tracker.unfinished());
        }
    });

	opts = {
        testspec: options.testspec,
        moduleStart: function (name) {
            console.log('\n' + bold(name));
        },
        testDone: function (name, assertions) {
            tracker.remove(name);

            if (!assertions.failures()) {
                console.log('\u2714 ' + name);
            }
            else {
                console.log(error('\u2716 ' + name) + '\n');
                assertions.forEach(function (a) {
                    if (a.failed()) {
                        a = utils.betterErrors(a);
                        if (a.error instanceof AssertionError && a.message) {
                            console.log(
                                'Assertion Message: ' +
                                assertion_message(a.message)
                            );
                        }
                        console.log(a.error.stack + '\n');
                    }
                });
            }
        },
        done: function (assertions, end) {
			var duration;
            end = end || new Date().getTime();
            duration = end - start;
            if (assertions.failures()) {
                console.log(
                    '\n' + bold(error('FAILURES: ')) + assertions.failures() +
                    '/' + assertions.length + ' assertions failed (' +
                    assertions.duration + 'ms)'
                );
            }
            else {
                console.log(
                   '\n' + bold(ok('OK: ')) + assertions.length +
                   ' assertions (' + assertions.duration + 'ms)'
                );
            }

			// do we have a global callback?
			if (options.done && typeof options.done === "function") {
				options.done();
			}
        },
        testStart: function(name) {
            tracker.put(name);
        }
    };
	if (files && files.length) {
	    paths = files.map(function (p) {
	        return path.join(process.cwd(), p);
	    });
	    nodeunit.runFiles(paths, opts);
	} else {
		nodeunit.runModules(files,opts);
	}
};
