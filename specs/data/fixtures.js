'use strict';

var db = require('../../api/components/db');

exports = module.exports = {
  cleanup: function(callback) {
    db.flushall(callback);
  }
};
