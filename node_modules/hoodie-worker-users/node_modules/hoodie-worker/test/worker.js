var assert = require("assert");
var sinon  = require("sinon");
var Worker = require("./../lib/worker");

describe("Worker", function() {

  beforeEach(function(){
    this.worker = new Worker();
    this.worker.name = 'test';
  })

  it('should inherit from EventEmitter', function( done ){
    this.worker.on('foo', done);
    this.worker.emit('foo');
  });

  describe("#setup(config)", function() {
    it("should have test", function() {
      assert(true);
    });
  });

  describe("#install()", function() {
    it("should return a resolved promise", function( done) {
      this.worker.install().then( done )
    });
  });

  describe("#when()", function() {
    it("should provide when.js api", function( done) {
      this.worker.when().then( done )
    });
  });

  describe("#promisify()", function( done ) {
    it("should promisify a node-style callback function", function( done) {
      var nodeFunc = function( cb ) { cb() }
      var promisifiedFunc = this.worker.promisify(nodeFunc)
      promisifiedFunc().then( done )
    });
    it("should promisify a node-style callback function (testing error)", function( done) {
      var nodeFunc = function( cb ) { cb({error: 'oops'}) }
      var promisifiedFunc = this.worker.promisify(nodeFunc)
      promisifiedFunc().then( null, function() { done() } )
    });
    it("should promisify a node-style callback function with context", function( done) {
      var context = {
        proxy : function( cb ) { cb() },
        func  : function( cb ) { this.proxy(cb) }
      }
      var promisifiedFunc = this.worker.promisify(context, 'func')
      promisifiedFunc().then( done )
    });
    it("should promisify a node-style callback function with context (testing error)", function( done) {
      var context = {
        proxy : function( cb ) { cb({error: 'oops'}) },
        func  : function( cb ) { this.proxy(cb) }
      }
      var promisifiedFunc = this.worker.promisify(context, 'func')
      promisifiedFunc().then( null, function() { done() } )
    });
  });

  describe('#log(message)', function () {
    before( function () {
      sinon.stub(console, 'log');
    })
    after( function () {
      console.log.restore()
    })

    it('should log nicely', function ( ) {
      this.worker.log("check 1,2")
      console.log.lastCall.args[0].should.eql('[test]\tcheck 1,2')
    });
  });

  describe('#handleError(error, message)', function () {
    beforeEach( function () {
      sinon.stub(this.worker, 'log');
      sinon.stub(console, 'log');
    })
    afterEach( function () {
      this.worker.log.restore()
      console.log.restore()
    })
    describe('without message passed', function () {
      it('it should log error', function () {
        this.worker.handleError({error: 'ooops'})
        this.worker.log.args[0][0].should.eql('Error')
        this.worker.log.args[1][0].should.match(/at Worker.handleError/)

        // empty lines before / after error
        console.log.callCount.should.eql(2)
      });
    });
    describe('with message passed', function () {
      it('it should log error', function () {

        this.worker.handleError({error: 'ooops'}, "something went wrong")
        this.worker.log.args[0][0].should.eql('Error: something went wrong')
        this.worker.log.args[1][0].should.match(/at Worker.handleError/)

        // empty lines before / after error
        console.log.callCount.should.eql(2)
      });
    });
  });

  describe('#handleErrorWithMessage(message)', function () {
    beforeEach( function () {
      sinon.stub(this.worker, 'handleError');
    })
    afterEach( function () {
      this.worker.handleError.restore();
    })
    it('should wrap #handleError(error, message) ', function () {
      var handleError = this.worker.handleErrorWithMessage('context information')
      handleError({error: 'ooops'})
      this.worker.handleError.lastCall.args[0].should.eql({error: 'ooops'})
      this.worker.handleError.lastCall.args[1].should.eql('context information')
    });
  });
});