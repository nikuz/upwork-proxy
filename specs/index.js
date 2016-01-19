'use strict';

var _ = require('underscore'),
  env = require('dotenv');

env.load();

process.env.CURRENT_ENV = 'TEST';

var specs = [
  './account',
  './notifier'
];

describe('upwork-proxy API specs', function() {
  if (process.env.SPECS_TARGET) {
    var target = './' + process.env.SPECS_TARGET;
    if (_.contains(specs, target)) {
      require(target);
    } else {
      console.log('Target specs doesn\'t exists');
    }
  } else {
    _.each(specs, function(item) {
      require(item);
    });
  }
});
