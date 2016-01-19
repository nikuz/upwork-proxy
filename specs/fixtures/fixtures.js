'use strict';

var db = require('../../api/db');

exports = module.exports = {
  cleanup: function(callback) {
    db.flushall(callback);
  }
};
