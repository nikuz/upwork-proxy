'use strict';

module.exports.getTrue = function(options, callback) {
  callback = callback || function() {};
  callback(null, {
    success: true
  });
};
