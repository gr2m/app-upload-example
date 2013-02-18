var assert = require("assert");
var sinon  = require("sinon");
var when   = require("when");
var fs     = require("fs");
var cradle = require("cradle");

var Worker           = require("./../lib/worker");
var setupHelper      = require("./../lib/setup");
var Setup            = require("./../lib/setup").Setup;

var getWorkerMock = function() {
  return {
    name : 'test',
    config : {
      server : 'https://couch.myapp.com:80',
      admin  : {
        user : 'admin',
        pass : 'secret'
      }
    },
    install : function() {},
    log : function() {},
    handleError : function() {},
    when : Worker.prototype.when,
    promisify : Worker.prototype.promisify
  }
}
var CouchMock = function(options) {
  this.options = options;
}
CouchMock.prototype.databaseApi = {
  get  : function() {},
  save : function() {}
}
CouchMock.prototype.database = function(name) {
  return this.databaseApi
}



describe("setupHelper(worker, config)", function() {
  beforeEach( function () {
    this.assureInstallationDefer = when.defer()
    sinon.stub(Setup.prototype, 'assureInstallation').returns( this.assureInstallationDefer.promise );
    sinon.stub(Setup.prototype, 'initCouchConnection');
    this.workerMock = getWorkerMock()
    sinon.stub(this.workerMock, 'handleError').returns( when.reject('error') );
    sinon.stub(fs, 'readFileSync').returns('{ "version" : "1.2.3"}');
  })
  afterEach( function () {
    Setup.prototype.assureInstallation.restore();
    Setup.prototype.initCouchConnection.restore();
    fs.readFileSync.restore()
  })

  it('should init worker Setup', function(){
    var config = { name: 'test'}
    setupHelper(this.workerMock, config)
    this.workerMock.name.should.eql('test')
    this.workerMock.version.should.eql('1.2.3')
    this.workerMock.config.should.eql( config )
    Setup.prototype.assureInstallation.callCount.should.eql(1)
    Setup.prototype.initCouchConnection.callCount.should.eql(1)
  });


  describe('when #assureInstallation() fails with "error"', function () {
    beforeEach(function () {
      setupHelper(this.workerMock, { name: 'test'})
      this.promise = this.assureInstallationDefer.reject('error')
    });
    it('should handle the error', function(){
      this.workerMock.handleError.callCount.should.eql(1)
      this.workerMock.handleError.lastCall.args[0].should.eql('error')
    });

    it('should return handleError\'s promise', function() {
      var spy = sinon.spy()
      this.promise.then( null, spy );
      assert( spy.calledWith('error') )
    });
  });
}); // setupHelper

describe('Setup', function () {  
  beforeEach(function(){
    cradle.Connection = CouchMock
    var workerMock = getWorkerMock()
    this.setup = new Setup(workerMock)
    sinon.stub(this.setup.worker, 'log')
  })
  afterEach(function () {
    this.setup.worker.log.restore()
  });

  describe('#initCouchConnection()', function () {
    // gets called in new Setup(workerMock)
    it('should init a connection to the couch', function () {
      this.setup.worker.couch.options.hostname.should.eql( 'couch.myapp.com' )
      this.setup.worker.couch.options.port.should.eql( '80' )
      this.setup.worker.couch.options.auth.username.should.eql( 'admin' )
      this.setup.worker.couch.options.auth.password.should.eql( 'secret' )
    });
  }); // #initCouchConnection()

  describe('#assureInstallation()', function () {
    beforeEach(function(){
      this.readGlobalConfigDefer = when.defer()
      this.readUserConfigDefer   = when.defer()

      sinon.stub(this.setup, 'readGlobalConfig').returns( this.readGlobalConfigDefer.promise );
      sinon.stub(this.setup, 'readUserConfig').returns( this.readUserConfigDefer.promise );
    })
    afterEach(function () {
      this.setup.readGlobalConfig.restore()
      this.setup.readUserConfig.restore()
    });

    it('should return a promise', function () {
      assert( when.isPromise(this.setup.assureInstallation()) )
    });

    describe('when #readGlobalConfig() succeeds', function () {
      beforeEach(function () {
        this.readGlobalConfigDefer.resolve()
      });

      it('should call #readUserConfig()', function(){
        this.setup.assureInstallation()
        assert(this.setup.readUserConfig.calledOnce)
      });

      describe('when #readUserConfig() succeeds with w00t', function () {
        beforeEach(function () {
          this.readUserConfigDefer.resolve('w00t')
        });
        it('should resolve with w00t', function () {
          var spy = sinon.spy()
          this.setup.assureInstallation().then( spy );
          assert( spy.calledWith('w00t') )
        });
      });
    });

    it('should return handleError\'s promise', function() {
      var promise = this.setup.assureInstallation()
      this.readGlobalConfigDefer.reject('ooops')
      var spy = sinon.spy()
      promise.then(null, spy)
      assert( spy.calledWith('ooops') )
    });
  }); // #assureInstallation()

  describe('#readGlobalConfig()', function () {
    beforeEach(function () {

      sinon.spy(this.setup, 'setGlobalConfig')
      sinon.spy(this.setup.worker.couch, 'database')
      sinon.stub(this.setup.worker.couch.databaseApi, 'get')
    });
    afterEach(function () {
      this.setup.setGlobalConfig.restore()
      this.setup.worker.couch.database.restore()
      this.setup.worker.couch.databaseApi.get.restore()
    });
    
    it('should load global settings from module/appconfig doc in modules database', function () {
      var get = this.setup.worker.couch.databaseApi.get

      this.setup.readGlobalConfig()
      assert(this.setup.worker.couch.database.calledWith('modules'))
      get.callCount.should.eql(1)
      get.lastCall.args[0].should.eql('module/appconfig')
    });

    describe('when loading global settings succeeds', function () {
      beforeEach(function () {
        var get = this.setup.worker.couch.databaseApi.get
        get.callsArgWith(1, undefined, { config: 'config'})
      });

      it('should call #setGlobalConfig( object )', function () {
        var spy = sinon.spy()
        this.setup.readGlobalConfig()
        assert( this.setup.setGlobalConfig.calledWith( {config: 'config'} ) )
      });

      it('should return a resolved promise', function(done){
        var spy = sinon.spy()
        this.setup.readGlobalConfig().then( done )
      });
    });

    describe('when global settings cannot be loaded', function () {
      beforeEach(function () {
        var get = this.setup.worker.couch.databaseApi.get
        get.callsArgWith(1, 'error')
      });

      it('should return a rejected promise', function () {
        var spy = sinon.spy()
        this.setup.readGlobalConfig().then(null, spy)
        var error = spy.lastCall.args[0]
        assert(error instanceof Error)
        assert(error.message === 'error')
      });
    });
  }); // #readGlobalConfig()

  describe('#readUserConfig()', function () {
    beforeEach(function () {

      sinon.spy(this.setup, 'setWorkerConfig')
      sinon.stub(this.setup, 'handleReadWorkerConfigError').returns( when.reject('error') )
      sinon.spy(this.setup.worker.couch, 'database')
      sinon.stub(this.setup.worker.couch.databaseApi, 'get')
    });
    afterEach(function () {
      this.setup.setWorkerConfig.restore()
      this.setup.handleReadWorkerConfigError.restore()
      this.setup.worker.couch.database.restore()
      this.setup.worker.couch.databaseApi.get.restore()
    });
    
    it('should load worker settings from module/test doc in modules database', function () {
      var get = this.setup.worker.couch.databaseApi.get

      this.setup.readUserConfig()
      assert(this.setup.worker.couch.database.calledWith('modules'))
      get.callCount.should.eql(1)
      get.lastCall.args[0].should.eql('module/test')
    });

    describe('when loading worker settings succeeds', function () {
      beforeEach(function () {
        var get = this.setup.worker.couch.databaseApi.get
        get.callsArgWith(1, undefined, { config: 'config'})
      });

      it('should call #setWorkerConfig( object )', function () {
        var spy = sinon.spy()
        this.setup.readUserConfig()
        assert( this.setup.setWorkerConfig.calledWith( {config: 'config'} ) )
      });

      it('should return a resolved promise', function(done){
        var spy = sinon.spy()
        this.setup.readUserConfig().then( done )
      });
    });

    describe('when worker settings cannot be loaded', function () {
      beforeEach(function () {
        var get = this.setup.worker.couch.databaseApi.get
        get.callsArgWith(1, 'error')
      });

      it('should handle the error', function(){
        this.setup.readUserConfig()
        var error = this.setup.handleReadWorkerConfigError.lastCall.args[0]
        assert(error instanceof Error)
        assert(error.message === 'error')
      });
      it('should return a rejected promise', function () {
        var spy = sinon.spy()
        this.setup.readUserConfig().then(null, spy)
        assert(spy.calledWith('error'))
      });
      });
  }); // #readUserConfig()

  describe('#handleReadWorkerConfigError(error)', function () {
    beforeEach(function () {
      this.installDefer = when.defer()
      this.createConfigInModulesDatabaseDefer = when.defer()

      sinon.stub(this.setup, 'createConfigInModulesDatabase').returns ( this.createConfigInModulesDatabaseDefer.promise )
      sinon.stub(this.setup.worker, 'install').returns( this.installDefer.promise )
    });
    afterEach(function () {
      this.setup.createConfigInModulesDatabase.restore()
      this.setup.worker.install.restore()
    });

    describe('when error is "not_found"', function () {
      beforeEach(function () {
        this.promise = this.setup.handleReadWorkerConfigError( {name: 'not_found'} )
      });
      it('should install', function () {
        assert( this.setup.worker.install.calledOnce )
      });

      describe('when install succeeds', function () {
        beforeEach(function () {
          this.installDefer.resolve()
        });
        it('should run createConfigInModulesDatabase', function() {
          assert( this.setup.createConfigInModulesDatabase.calledOnce )
        });

        describe('when createConfigInModulesDatabase succeeds', function () {
          beforeEach(function () {
            this.createConfigInModulesDatabaseDefer.resolve()
          }); 
          it('should return a resolved promise', function (done) {
            this.promise.then(done)
          });
        });

        describe('when createConfigInModulesDatabase fails', function () {
          beforeEach(function () {
            this.createConfigInModulesDatabaseDefer.reject(({ name: 'banana'}))
          }); 
          it('should return a resolved promise', function () {
            var spy = sinon.spy()
            this.promise.then(null, spy)
            assert( spy.calledWith({name: 'banana'}) )
          });
        });
      });

      describe('when install fails', function () {
        beforeEach(function () {
          this.installDefer.reject({reason: 'meeeoooouuuuw'})
        });
        it('should not run createConfigInModulesDatabase', function() {
          assert( this.setup.createConfigInModulesDatabase.notCalled )
        });
        it('should return a rejected promise', function(){
          var spy = sinon.spy()
          this.promise.then(null, spy)
          assert( spy.calledWith({reason: 'meeeoooouuuuw'}) )
        });
      });
    })

    describe('when error is "ooops"', function () {
      beforeEach(function () {
        this.promise = this.setup.handleReadWorkerConfigError( {reason: 'ooops'} )
      });
      it('should not install', function () {
        assert( this.setup.worker.install.notCalled )
      });
      it('should return a rejected promise', function(){
        var spy = sinon.spy()
        this.promise.then(null, spy)
        assert( spy.calledWith({reason: 'ooops'}) )
      });
    })
  }); // #handleReadWorkerConfigError

  describe('#createConfigInModulesDatabase()', function () {
    beforeEach(function () {
      sinon.spy(this.setup, 'setWorkerConfig')
      sinon.spy(this.setup.worker.couch, 'database')

      this.saveDefer = when.defer()
      sinon.stub(this.setup.worker.couch.databaseApi, 'save')

      this.doc = {
        "_id"       : "module/test", 
        "createdAt" : new Date(),
        "updatedAt" : new Date(),
        "config"    : {}
      }
    });
    afterEach(function () {
      this.setup.setWorkerConfig.restore()
      this.setup.worker.couch.database.restore()
      this.setup.worker.couch.databaseApi.save.restore()
    });

    it('should create document in modules database', function () {
      this.promise = this.setup.createConfigInModulesDatabase()
      assert( this.setup.worker.couch.database.calledWith('modules') )
      assert( this.setup.worker.couch.databaseApi.save.calledWith(this.doc) )
    });

    describe('when creating document succeeds', function () {
      beforeEach(function () {
        this.response = {"ok":true,"id":"bada33","rev":"1-bada33"}

        var save = this.setup.worker.couch.databaseApi.save
        save.callsArgWith(1, undefined, this.response)
        
        this.promise = this.setup.createConfigInModulesDatabase()
      });
      it('should set worker config', function(){
        assert( this.setup.setWorkerConfig.calledWith( this.doc ) )
      });
      it('should return a resolved promise', function(){
        var spy = sinon.spy()
        this.promise.then(spy)
        assert( spy.calledWith( this.response ) )
      });
    });

    describe('when creating document fails', function () {
      beforeEach(function () {
        var save = this.setup.worker.couch.databaseApi.save
        this.error = {"error":"bad_request","reason":"Chuck Norris said you can't."}
        save.callsArgWith(1, this.error)
        this.promise = this.setup.createConfigInModulesDatabase()
      });
      it('should not set worker config', function(){
        assert( this.setup.setWorkerConfig.notCalled )
      });
      it('should return a rejected promise', function(){
        var spy = sinon.spy()
        this.promise.then(null, spy)

        var error = spy.lastCall.args[0]
        assert(error instanceof Error)
        assert(error.name === 'bad_request')
        assert(error.message === 'Chuck Norris said you can\'t.')
      });
    });
  }); // #createConfigInModulesDatabase
}); // Setup