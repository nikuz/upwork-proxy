'use strict';

process.env.CURRENT_ENV = 'TEST';

describe('upwork-proxy API specs', function() {
  require('./jobs');
  require('./notifier');
  require('./account');
});
