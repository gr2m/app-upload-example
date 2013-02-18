var url     = require("url"),
    fs      = require("fs"),
    cradle  = require("cradle");


var setupHelper = function(worker, config) {
  worker.name    = config.name;
  delete config.name;

  worker.version = getWorkerVersion()

  worker.config = config;
  var setup = new Setup(worker);

  return setup.assureInstallation()
  .otherwise( setup.worker.handleError.bind(setup.worker) );
};

var getWorkerVersion = function() {
  var package_json = JSON.parse(fs.readFileSync(__dirname + "/../../../package.json"));
  return package_json.version
}
var Setup = function(worker) {
  this.worker = worker;
  this.initCouchConnection();
};

Setup.prototype.initCouchConnection = function() {
  var options = url.parse(this.worker.config.server);

  if (this.worker.config.admin) {
    options.auth = {
      username: this.worker.config.admin.user,
      password: this.worker.config.admin.pass
    };
  }
  this.worker.couch = new(cradle.Connection)(options);
};

Setup.prototype.assureInstallation = function() {
  return this.readGlobalConfig()
  .then( this.readUserConfig.bind(this) );
};

Setup.prototype.readGlobalConfig = function() {
  var get = this.worker.promisify( this.worker.couch.database('modules'), 'get' );
  var id = 'module/appconfig'
  this.worker.log("[Setup]\treading global config from modules/%s …", id)
  return get( id )
  .then( this.setGlobalConfig.bind(this) )
};

Setup.prototype.readUserConfig = function() {
  var get = this.worker.promisify( this.worker.couch.database('modules'), 'get' )
  var id = "module/" + this.worker.name
  
  this.worker.log("[Setup]\treading user config from modules/%s …", id)
  return get( id )
  .then(
    this.setWorkerConfig.bind(this),
    this.handleReadWorkerConfigError.bind(this)
  );
};

Setup.prototype.setGlobalConfig = function(object) {
  this.worker.config.app = object.config;
};

Setup.prototype.setWorkerConfig = function(object) {
  this.worker.config.user = object.config;
};

Setup.prototype.handleReadWorkerConfigError = function(error) {
  if (error.name === "not_found") {

    this.worker.log("[Setup]\t/modules/%s not yet setup", this.worker.name);
    return this.worker.install()
    .then( this.createConfigInModulesDatabase.bind(this) )

  } else {
    return this.worker.when.reject( error );
  }
}

Setup.prototype.createConfigInModulesDatabase = function() {
  this.worker.log('[Setup]\tcreatinging object in modules database …');

  var doc = {
    "_id"       : "module/" + this.worker.name, 
    "createdAt" : new Date(),
    "updatedAt" : new Date(),
    "config"    : {}
  };
  var save = this.worker.promisify( this.worker.couch.database('modules'), 'save' )
  var promise = save( doc )
  promise.then( function() {
    this.setWorkerConfig( doc );
  }.bind(this) )

  return promise;
};

module.exports = setupHelper
module.exports.Setup = Setup