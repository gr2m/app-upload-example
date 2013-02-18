var setup        = require("./setup.js");
var when         = require("when/debug");
var promisify    = require("when-promisify");
var util         = require('util');
var EventEmitter = require('events').EventEmitter;

function Worker(config) {}
util.inherits(Worker, EventEmitter);

// 
// promise FTW!
// 
Worker.prototype.when = when

Worker.prototype.setup = function(config) {
  return setup(this, config);
};
Worker.prototype.install = function() {
  return this.when.resolve();
};


// 
// promisify!
// 
Worker.prototype.promisify = promisify;

// 
// helper for nicer logging
// 
Worker.prototype.log = function(message) {
  message = "[" + this.name + "]\t" + message;
  console.log.apply(null, arguments);
};

//
// report errors nicely
//
Worker.prototype.handleError = function(error, message) {
  var messageArgs, stackLines, errorProperties;

  // make sure we have a proper error object
  if (! (error instanceof Error)) {
    errorProperties = error
    error = new Error()
    if (errorProperties.error) {
      error.name = error.error;
      error.message = error.message || error.reason;
    }  
  }

  if (message) {
    if (! error.message) {
      error.message = message;
    } else {
      error.message += "\n" + message;
    } 
  }
  
  console.log("") // add blank line before error
  stackLines = error.stack.split(/\n/)
  for (var i = 0; i < stackLines.length; i++) {
    this.log(stackLines[i]);
  }
  console.log("") // add blank line after error

  return this.when.reject(error);
};
Worker.prototype.handleErrorWithMessage = function(message) {
  var args = Array.prototype.slice.call(arguments)
  return function(error) {
    args.unshift(error)
    return this.handleError.apply( this, args)
  }.bind(this);
};

module.exports = Worker;