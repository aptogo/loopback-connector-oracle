require('./init/init');
var should = require('should');
var ds, SpatialModel;

before(function (done) {
  ds = getDataSource();
  var schema =
  {
    "name": "SpatialTest",
    "options": {
      "oracle": {
        "table": "SPATIAL_TEST"
      }
    },
    "properties": {
      "name": {type: 'String'},
      "point": {"type": 'GeoPoint'}
    }
  };

  SpatialModel = ds.createModel(schema.name, schema.properties, schema.options);
  ds.automigrate(done);
});

describe('Oracle connector', function () {
  it('should be ok', function (done) {
    SpatialModel.create({name: 'test1', point:{lat: 52, lng:-1}}, function(err, result) {
      should.not.exists(err);
      SpatialModel.findById(result.id, function(err, result) {
        should.not.exists(err);
        result.should.have.property('name', 'test1');
        result.should.have.property('point', {lat:52, lng: -1});
        done();
      });
    });
  });
});
