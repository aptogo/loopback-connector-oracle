var assert = require('assert');
var wktParser = require('wellknown');

module.exports = GeoJSON;

var DEFAULT_SRID = 4326;

function GeoJSON(data, srid) {

  if (!(this instanceof GeoJSON)) {
    return new GeoJSON(data);
  }

  assert(typeof data === 'object' || typeof data === 'string', 'must provide GeoJSON object or WKT string');

  var self = this;

  this.srid = srid || DEFAULT_SRID;

  if (typeof data === 'string') {
    this._data = wktParser.parse(data);
  }
  else {
    this._data = data;
  }

  Object.defineProperty(this, 'type', {
    get: function() {
      return this._data.type;
    }
  });

  Object.defineProperty(this, 'coordinates', {
    get: function() {
      return this._data.coordinates;
    }
  });

}

GeoJSON.prototype.toWkt = function () {
  return wktParser.stringify(this._data);
};
