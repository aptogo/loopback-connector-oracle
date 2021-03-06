
var moment = require('moment');
var should = require('should');

require('./init/init');
require('loopback-datasource-juggler/test/common.batch.js');
require('loopback-datasource-juggler/test/include.test.js');

var Post, db;

describe('oracle connector', function () {

  before(function () {
    db = getDataSource();

    Post = db.define('PostWithBoolean', {
      title: { type: String, length: 255, index: true },
      date: { type: Date },
      timestamp: { type: Date, oracle: {dataType: 'TIMESTAMP'}},
      content: { type: String },
      approved: Boolean
    });
  });

  it('should run migration', function (done) {
    db.automigrate('PostWithBoolean', function () {
      done();
    });
  });

  var post;
  it('should support boolean types with true value', function(done) {
    Post.create({title: 'T1', content: 'C1', approved: true}, function(err, p) {
      should.not.exists(err);
      post = p;
      Post.findById(p.id, function(err, p) {
        should.not.exists(err);
        p.should.have.property('approved', true);
        done();
      });
    });
  });

  it('should support updating boolean types with false value', function(done) {
    Post.update({id: post.id}, {approved: false}, function(err) {
      should.not.exists(err);
      Post.findById(post.id, function(err, p) {
        should.not.exists(err);
        p.should.have.property('approved', false);
        done();
      });
    });
  });


  it('should support boolean types with false value', function(done) {
    Post.create({title: 'T2', content: 'C2', approved: false}, function(err, p) {
      should.not.exists(err);
      post = p;
      Post.findById(p.id, function(err, p) {
        should.not.exists(err);
        p.should.have.property('approved', false);
        done();
      });
    });
  });

  it('should return the model instance for upsert', function(done) {
    Post.upsert({id: post.id, title: 'T2_new', content: 'C2_new',
      approved: true}, function(err, p) {
      p.should.have.property('id', post.id);
      p.should.have.property('title', 'T2_new');
      p.should.have.property('content', 'C2_new');
      p.should.have.property('approved', true);
      done();
    });
  });

  it('should return the model instance for upsert when id is not present',
    function(done) {
      Post.upsert({title: 'T2_new', content: 'C2_new', approved: true},
        function(err, p) {
          p.should.have.property('id');
          p.should.have.property('title', 'T2_new');
          p.should.have.property('content', 'C2_new');
          p.should.have.property('approved', true);
          done();
        });
    });

  it('should delete by id', function(done) {
    Post.deleteById(1, function(err, result) {
      result.should.have.property('count', 1);
      done();
    });
  });

  it('should escape number values to defect SQL injection in findById',
    function(done) {
      Post.findById('(SELECT 1+1)', function(err, p) {
        should.exists(err);
        done();
      });
    });

  it('should escape number values to defect SQL injection in find',
    function(done) {
      Post.find({where: {id: '(SELECT 1+1)'}}, function(err, p) {
        should.exists(err);
        done();
      });
    });

  it('should escape number values to defect SQL injection in find with gt',
    function(done) {
      Post.find({where: {id: {gt: '(SELECT 1+1)'}}}, function(err, p) {
        should.exists(err);
        done();
      });
    });

  it('should escape number values to defect SQL injection in find',
    function(done) {
      Post.find({limit: '(SELECT 1+1)'}, function(err, p) {
        should.exists(err);
        done();
      });
    });

  it('should escape number values to defect SQL injection in find with inq',
    function(done) {
      Post.find({where: {id: {inq: ['(SELECT 1+1)']}}}, function(err, p) {
        should.exists(err);
        done();
      });
    });

  it('should support date types', function(done) {
    Post.create({title: 'T1', date: moment('2016-01-01T12:00:01Z').toDate(), approved: true}, function(err, p) {
      should.not.exists(err);
      post = p;
      Post.findById(p.id, function(err, p) {
        should.not.exists(err);
        p.date.should.be.a.Date();
        moment(p.date).isSame(moment('2016-01-01T12:00:01Z')).should.be.true();
        done();
      });
    });
  });

  it('should support timestamp types', function(done) {
    Post.create({title: 'T1', timestamp: moment('2016-01-01T12:00:02Z').toDate(), approved: true}, function(err, p) {
      should.not.exists(err);
      post = p;
      Post.findById(p.id, function(err, p) {
        should.not.exists(err);
        p.timestamp.should.be.a.Date();
        moment(p.timestamp).isSame(moment('2016-01-01T12:00:02Z')).should.be.true();
        done();
      });
    });
  });

});