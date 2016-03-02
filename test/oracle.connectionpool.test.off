process.env.NODE_ENV = 'test';
require('should');

var async = require('async');

var DataSource = require('loopback-datasource-juggler').DataSource;
var db, config;

before(function () {
  config = require('rc')('loopback', {test: {oracledb: {}}}).test.oracledb;
});

after(function () {
  db = null;
});

describe('Oracle connector', function () {
  it('should create connection pool', function (done) {
    db = new DataSource(require('../'), config);
    db.connect(function () {
      var pool = db.connector.pool;
      pool.should.have.property('connectionsInUse', 0);
      pool.should.have.property('connectionsOpen', 0);
      pool.should.have.property('poolMax', 4);
      pool.should.have.property('poolMin', 0);
      pool.should.have.property('poolIncrement', 1);
      pool.should.have.property('poolTimeout', 60);
      db.disconnect();
      done();
    });
  });

  it('should create connection pool', function (done) {
    config.poolMin = 2;
    config.poolMax = 4;
    config.poolIncrement = 2;
    config.poolTimeout = 5;
    db = new DataSource(require('../'), config);
    db.connect(function () {
      var pool = db.connector.pool;
      pool.should.have.property('connectionsOpen', 2);
      pool.should.have.property('connectionsInUse', 0);
      pool.should.have.property('poolMax', 4);
      pool.should.have.property('poolMin', 2);
      pool.should.have.property('poolIncrement', 2);
      pool.should.have.property('poolTimeout', 5);

      var tasks = [];
      for (var i = 0; i < 3; i++) {
        tasks.push(db.connector.pool.getConnection.bind(db.connector.pool));
      }
      async.parallel(tasks, function (err, connections) {
        connections.should.have.property('length', 3);
        var pool = db.connector.pool;
        //pool.should.have.property('connectionsOpen', 4);
        //pool.should.have.property('connectionsInUse', 3);


        async.each(connections, function (connection, done) {
          connection.release(done);
        }, function (err) {
          db.disconnect(done);
        });
      });
    });
  });
});
