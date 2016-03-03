require('./init/init');
var should = require('should');
var GeoJSON = require('../lib/geojson');
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
      "point": {"type": 'GeoPoint'},
      "geojson": {"type": 'GeoJSON'}
    }
  };

  SpatialModel = ds.createModel(schema.name, schema.properties, schema.options);
  ds.automigrate(done);
});

describe('Oracle Spatial', function () {
  it('should persist GeoPoint', function (done) {
    SpatialModel.create({name: 'geopoint_test', point:{lat: 52, lng:-1}}, function(err, result) {
      should.not.exists(err);
      SpatialModel.findById(result.id, function(err, result) {
        should.not.exists(err);
        result.should.have.property('name', 'geopoint_test');
        result.should.have.property('point', {lat:52, lng: -1});
        done();
      });
    });
  });

  it('should persist GeoJSON point', function (done) {

    var geojson = {type: 'Point', coordinates: [-1,53] };

    SpatialModel.create({name: 'geojsonpoint_test', geojson:geojson}, function(err, result) {
      should.not.exists(err);
      SpatialModel.findById(result.id, function(err, result) {
        should.not.exists(err);
        result.should.have.property('name', 'geojsonpoint_test');
        result.geojson.type.should.equal(geojson.type);
        result.geojson.coordinates.should.deepEqual(geojson.coordinates);
        done();
      });
    });
  });

  it('should persist GeoJSON polygon', function (done) {

    var geojson = { type: 'Polygon',
      'coordinates': [
        [ [100.0, 0.0], [101.0, 0.0], [101.0, 1.0], [100.0, 1.0], [100.0, 0.0] ]
      ]
    };

    SpatialModel.create({name: 'polygon_test', geojson:geojson}, function(err, result) {
      should.not.exists(err);
      SpatialModel.findById(result.id, function(err, result) {
        should.not.exists(err);
        result.should.have.property('name', 'polygon_test');
        result.geojson.type.should.equal(geojson.type);
        result.geojson.coordinates.should.deepEqual(geojson.coordinates);
        done();
      });
    });
  });

  it('should persist GeoJSON multipolygon', function (done) {

    var geojson ={ type: 'MultiPolygon',
      coordinates: [
        [[[102.0, 2.0], [103.0, 2.0], [103.0, 3.0], [102.0, 3.0], [102.0, 2.0]]],
        [[[100.0, 0.0], [101.0, 0.0], [101.0, 1.0], [100.0, 1.0], [100.0, 0.0]],
          [[100.2, 0.2], [100.8, 0.2], [100.8, 0.8], [100.2, 0.8], [100.2, 0.2]]]
      ]
    };

    SpatialModel.create({name: 'multipolygon_test', geojson:geojson}, function(err, result) {
      should.not.exists(err);
      SpatialModel.findById(result.id, function(err, result) {
        should.not.exists(err);
        result.should.have.property('name', 'multipolygon_test');
        result.geojson.type.should.equal(geojson.type);
        result.geojson.coordinates.should.deepEqual(geojson.coordinates);
        done();
      });
    });
  });
});
