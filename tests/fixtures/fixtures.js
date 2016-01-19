'use strict';

var db = require('../../app/db');

exports = module.exports = {
  cleanup: function(callback) {
    db.flushall(callback);
  }
};
