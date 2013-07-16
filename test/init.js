var Schema = require('loopback-data').Schema;

global.getSchema = function() {
    var db = new Schema(require('../'), {
        host:'127.0.0.1',
        database:'XE',
        username:'test',
        password:'password',
        debug: true
    });
    db.log = function (a) { console.log(a); };
    return db;
};
