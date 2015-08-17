'use strict';

var _ = require('underscore');

process.env.CURRENT_ENV = 'TEST';

var specs = [
  'jobs',
  'notifier',
  'account'
];

describe('upwork-proxy API specs', function() {
  var target = process.env.SPECS_TARGET;
  if (target && _.contains(specs, target)) {
    require('./' + target);
  } else {
    _.each(specs, function(item) {
      require('./' + item);
    });
  }
});
