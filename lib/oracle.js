/*!
 * Oracle connector for LoopBack
 */
var oracledb = require('oracledb');
var SimpleOracleDB = require('simple-oracledb');
var SqlConnector = require('loopback-connector').SqlConnector;
var ParameterizedSQL = SqlConnector.ParameterizedSQL;
var util = require('util');
var async = require('async');
var debug = require('debug')('loopback:connector:oracle');
var debugConnection = require('debug')('loopback:connector:oracle:connection');
var GeoJSON = require('./geojson');

// Add simple clob support to oracledb client
SimpleOracleDB.extend(oracledb);

/*!
 * @module loopback-connector-oracle
 *
 * Initialize the Oracle connector against the given data source
 *
 * @param {DataSource} dataSource The loopback-datasource-juggler dataSource
 * @param {Function} [callback] The callback function
 */
exports.initialize = function initializeDataSource(dataSource, callback) {

  if (!oracledb) {
    return;
  }

  if (typeof callback !== 'function') {
    throw new Error('initializeDataSource requires a callback function');
  }

  // Register GeoJSON type
  dataSource.modelBuilder.defineValueType(GeoJSON);

  dataSource.connector = new Oracle(oracledb, dataSource.settings);
  dataSource.connector.dataSource = dataSource;

  dataSource.connector.connect(callback);
};

exports.Oracle = Oracle;

/**
 * Oracle connector constructor
 *
 *
 * @param {object} driver Oracle node.js binding
 * @options {Object} settings Options specifying data source settings; see below.
 * @prop {String} hostname The host name or ip address of the Oracle DB server
 * @prop {Number} port The port number of the Oracle DB Server
 * @prop {String} user The user name
 * @prop {String} password The password
 * @prop {String} database The database name (TNS listener name)
 * @prop {Boolean|Number} debug If true, print debug messages. If Number, ?
 * @class
 */
function Oracle(oracle, settings) {
  this.constructor.super_.call(this, 'oracle', settings);
  this.driver = oracle;
  this.pool = null;
  this.parallelLimit = settings.poolMax || 4;
  debug('Settings: %j', settings);
}

// Inherit from loopback-datasource-juggler BaseSQL
require('util').inherits(Oracle, SqlConnector);

/**
 * Connect to Oracle
 * @param {Function} [callback] The callback after the connection is established
 */
Oracle.prototype.connect = function (callback) {

  var self = this;

  if (this.pool) {
    if (callback) {
      process.nextTick(function () {
        callback(null, self.pool);
      });
    }
    return;
  }

  debug('Connecting to %s', this.settings.connectString);

  this.driver.createPool(this.settings, function (err, pool) {

    if (err) {
      debug("Error creating pool: %j", err);
      throw err;
    }

    self.pool = pool;

    debug('Connected to %s', self.settings.connectString);

    callback && callback(err, pool);
  });
};

/**
 * Execute the SQL statement.
 *
 * @param {String} sql The SQL statement.
 * @param {String[]} params The parameter values for the SQL statement.
 * @param {Function} [callback] The callback after the SQL statement is executed.
 */
Oracle.prototype.executeSQL = function (sql, params, options, callback) {

  debug('\nSQL: %s \nParameters: %j', sql, params);

  var transaction = options.transaction;
  if (transaction && transaction.connection && transaction.connector === this) {
    debug('Execute SQL within a transaction');
    if (sql.lastIndexOf("SELECT", 0) === 0) {
      // For SELECT queries use SimpleOracleDB query so that CLOB fields are automatically handled
      transaction.connection.query(sql, params, {autoCommit: false}, callback);
    }
    else {
      transaction.connection.execute(sql, params, {autoCommit: false}, callback);
    }
    return;
  }

  this.pool.run(function (connection, done) {
    if (sql.lastIndexOf("SELECT", 0) === 0) {
      // For SELECT queries use SimpleOracleDB query so that CLOB fields are automatically handled
      connection.query(sql, params, {autoCommit: true}, done);
    }
    else {
      connection.execute(sql, params, {autoCommit: true}, done);
    }
  }, callback);

};

/**
 * Get the place holder in SQL for values, such as :1 or ?
 * @param {String} key Optional key, such as 1 or id
 * @returns {String} The place holder
 */
Oracle.prototype.getPlaceholderForValue = function (key) {
  return ':' + key;
};

Oracle.prototype.getCountForAffectedRows = function (model, info) {
  return info && info.rowsAffected;
};

Oracle.prototype.getInsertedId = function (model, info) {
  return info && info.outBinds && info.outBinds[0][0];
};

Oracle.prototype.buildInsertDefaultValues = function (model, data, options) {
  // Oracle doesn't like empty column/value list
  var idCol = this.idColumnEscaped(model);
  return '(' + idCol + ') VALUES(DEFAULT)';
};

Oracle.prototype.buildInsertReturning = function (model, data, options) {
  var modelDef = this.getModelDefinition(model);
  var type = modelDef.properties[this.idName(model)].type;
  var outParam = null;
  if (type === String) {
    outParam = {type: oracledb.STRING, dir: oracledb.BIND_OUT};
  } else {
    outParam = {type: oracledb.NUMBER, dir: oracledb.BIND_OUT};
  }
  var params = [outParam];
  var returningStmt = new ParameterizedSQL('RETURNING ' +
    this.idColumnEscaped(model) + ' into ?', params);
  return returningStmt;
};

Oracle.prototype.create = function (model, data, options, callback) {
  var self = this;
  var stmt = this.buildInsert(model, data, options);
  this.execute(stmt.sql, stmt.params, options, function (err, info) {
    if (err) {
      if (err.toString().indexOf('ORA-00001: unique constraint') >= 0) {
        // Transform the error so that duplicate can be checked using regex
        err = new Error(err.toString() + '. Duplicate id detected.');
      }
      callback(err);
    } else {
      var insertedId = self.getInsertedId(model, info);
      callback(err, insertedId);
    }
  });
};

Oracle.prototype.toColumnValue = function (prop, val) {
  if (val == null) {
    // PostgreSQL complains with NULLs in not null columns
    // If we have an autoincrement value, return DEFAULT instead
    if (prop.autoIncrement || prop.id) {
      return new ParameterizedSQL('DEFAULT');
    }
    else {
      return null;
    }
  }
  if (prop.type === String) {
    return String(val);
  }
  if (prop.type === Number) {
    if (isNaN(val)) {
      return val;
    }
    return val;
  }
  if (prop.type === Date || prop.type.name === 'Timestamp') {
    // oracledb client marshals Javacript dates
    return val;
  }
  if (prop.type.name === 'GeoPoint') {
    return new ParameterizedSQL({
      sql: 'SDO_GEOMETRY(\'POINT(\' || ? || \' \' || ? || \')\', 4326)',
      params: [val.lng.toString(), val.lat.toString()]
    });
  }
  if (prop.type.name === 'GeoJSON') {
    return new ParameterizedSQL({
      sql: 'SDO_GEOMETRY(?, ?)',
      params: [val.toWkt(), val.srid]
    });
  }

  // Oracle support char(1) Y/N
  if (prop.type === Boolean) {
    if (val) {
      return 'Y';
    } else {
      return 'N';
    }
  }

  return this.serializeObject(val);
};

Oracle.prototype.fromColumnValue = function (prop, val) {

  if (val == null) {
    return val;
  }

  var type = prop && prop.type;

  if (type === Boolean) {
    if (typeof val === 'boolean') {
      return val;
    } else {
      return (val === 'Y' || val === 'y' || val === 'T' ||
      val === 't' || val === '1');
    }
  }
  else if (type.name === 'GeoPoint' || type.name === 'Point') {
    if (typeof val === 'string') {
      var point = new GeoJSON(val);
      return {
        lng: point.coordinates[0],
        lat: point.coordinates[1]
      };
    }
  }
  else if (type.name === 'GeoJSON') {
    if (typeof val === 'string') {
      return new GeoJSON(val);
    }
  }

  return val;
};

Oracle.prototype.dbName = function (name) {
  if (!name) {
    return name;
  }
  return name.toUpperCase();
};

Oracle.prototype.escapeName = function (name) {
  if (!name) {
    return name;
  }
  return '"' + name.replace(/\./g, '"."') + '"';
};

Oracle.prototype.tableEscaped = function (model) {
  var schemaName = this.schema(model);
  if (schemaName && schemaName !== this.settings.user) {
    return this.escapeName(schemaName) + '.' +
      this.escapeName(this.table(model));
  } else {
    return this.escapeName(this.table(model));
  }
};

Oracle.prototype.buildExpression =
  function (columnName, operator, columnValue, propertyValue) {
    if (propertyValue instanceof RegExp) {
      columnValue = "'" + propertyValue.source + "'";
      if (propertyValue.ignoreCase) {
        return new ParameterizedSQL(columnName + ' ~* ?', [columnValue]);
      } else {
        return new ParameterizedSQL(columnName + ' ~ ?', [columnValue]);
      }
    }
    switch (operator) {
      case 'like':
        return new ParameterizedSQL({
          sql: columnName + " LIKE ? ESCAPE '\\'",
          params: [columnValue]
        });
      case 'nlike':
        return new ParameterizedSQL({
          sql: columnName + " NOT LIKE ? ESCAPE '\\'",
          params: [columnValue]
        });
      default:
        // Invoke the base implementation of `buildExpression`
        var exp = this.invokeSuper('buildExpression',
          columnName, operator, columnValue, propertyValue);
        return exp;
    }
  };

function buildLimit(limit, offset) {
  if (isNaN(offset)) {
    offset = 0;
  }
  var sql = 'OFFSET ' + offset + ' ROWS';
  if (limit >= 0) {
    sql += ' FETCH NEXT ' + limit + ' ROWS ONLY';
  }
  return sql;
}

Oracle.prototype.applyPagination =
  function (model, stmt, filter) {
    var offset = filter.offset || filter.skip || 0;
    if (this.settings.supportsOffsetFetch) {
      // Oracle 12.c or later
      var limitClause = buildLimit(filter.limit, filter.offset || filter.skip);
      return stmt.merge(limitClause);
    } else {
      var paginatedSQL = 'SELECT * FROM (' + stmt.sql + ' ' +
        ')' + ' ' + ' WHERE R > ' + offset;

      if (filter.limit !== -1) {
        paginatedSQL += ' AND R <= ' + (offset + filter.limit);
      }

      stmt.sql = paginatedSQL + ' ';
      return stmt;
    }
  };

// Build column names for a SELECT query
// SDO_GEOMETRY types are converted to WKT and returned as CLOBs
Oracle.prototype.buildColumnNames = function (model, filter) {

  var fieldsFilter = filter && filter.fields;
  var cols = this.getModelDefinition(model).properties;
  if (!cols) {
    return '*';
  }
  var self = this;
  var keys = Object.keys(cols);
  if (Array.isArray(fieldsFilter) && fieldsFilter.length > 0) {
    // Not empty array, including all the fields that are valid properties
    keys = fieldsFilter.filter(function (f) {
      return cols[f];
    });
  } else if ('object' === typeof fieldsFilter &&
    Object.keys(fieldsFilter).length > 0) {
    // { field1: boolean, field2: boolean ... }
    var included = [];
    var excluded = [];
    keys.forEach(function (k) {
      if (fieldsFilter[k]) {
        included.push(k);
      } else if ((k in fieldsFilter) && !fieldsFilter[k]) {
        excluded.push(k);
      }
    });
    if (included.length > 0) {
      keys = included;
    } else if (excluded.length > 0) {
      excluded.forEach(function (e) {
        var index = keys.indexOf(e);
        keys.splice(index, 1);
      });
    }
  }

  var names = keys.map(function (property) {
    var prop = self.getPropertyDefinition(model, property);
    if (prop.type.name === 'GeoPoint' || prop.type.name === 'GeoJSON') {
      var columnEscaped = self.columnEscaped(model, property);
      return 'SDO_UTIL.TO_WKTGEOMETRY(' + columnEscaped + ') as ' + columnEscaped;
    }
    else {
      return self.columnEscaped(model, property);
    }
  });

  var columnNames = names.join(',');

  if (filter.limit || filter.offset || filter.skip) {
    var orderBy = this.buildOrderBy(model, filter.order);
    columnNames += ', ROW_NUMBER() OVER' + ' (' + orderBy + ') R';
  }
  return columnNames;
};

Oracle.prototype.buildSelect = function (model, filter, options) {
  if (!filter.order) {
    var idNames = this.idNames(model);
    if (idNames && idNames.length) {
      filter.order = idNames;
    }
  }

  var selectStmt = new ParameterizedSQL('SELECT ' +
    this.buildColumnNames(model, filter) +
    ' FROM ' + this.tableEscaped(model)
  );

  if (filter) {
    if (filter.where) {
      var whereStmt = this.buildWhere(model, filter.where);
      selectStmt.merge(whereStmt);
    }

    if (filter.limit || filter.skip || filter.offset) {
      selectStmt = this.applyPagination(model, selectStmt, filter);
    }
    else {
      if (filter.order) {
        selectStmt.merge(this.buildOrderBy(model, filter.order));
      }
    }
  }

  return this.parameterize(selectStmt);
};

/**
 * Disconnect from Oracle
 * @param {Function} [cb] The callback function
 */
Oracle.prototype.disconnect = function disconnect(cb) {
  var self = this;
  var err = null;
  if (this.pool) {
    debug('Disconnecting from %s' + this.settings.connectString);

    var pool = this.pool;
    this.pool = null;

    pool.terminate(function (err) {
      if (err) {
        debug('Fail to disconnect from %s: %j', self.settings.connectString, err);
      }
      cb && cb(err);
    });
  }
};

Oracle.prototype.ping = function (cb) {
  this.execute('select count(*) as result from user_tables', [], cb);
};

require('./migration')(Oracle);
require('./discovery')(Oracle);
require('./transaction')(Oracle);
