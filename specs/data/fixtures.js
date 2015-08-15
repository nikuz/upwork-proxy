'use strict';

var db = require('../../components/db');

exports = module.exports = {
  cleanup: function(callback) {
    db.flushall(callback);
  }
};
