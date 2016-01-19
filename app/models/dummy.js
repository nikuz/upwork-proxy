'use strict';

module.exports.getTrue = function(options, callback) {
  var cb = callback || function() {};
  cb(null, {
    success: true
  });
};
