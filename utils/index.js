'use strict';

var _ = require('underscore');

var utils = [
  './account_convert_fields'
];

exports = module.exports = function(grunt, done, env, target) {
  env = env && env.toUpperCase();
  if (env !== 'DEV') {
    env = 'TEST';
  }
  process.env.CURRENT_ENV = env;

  target = './' + target;
  if (target && _.contains(utils, target)) {
    grunt.option('stack', true);
    require(target)(grunt, done);
  } else {
    grunt.log.error('Target utility doesn\'t exists');
    done(false);
  }
};
