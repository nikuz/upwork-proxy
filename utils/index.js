'use strict';

var _ = require('underscore'),
  qs = require('querystring');

var utils = [
  './account_convert_fields',
  './restore_notifications_topics'
];

exports = module.exports = function(grunt, done, env, target, args) {
  env = env && env.toUpperCase();
  if (!env) {
    env = 'TEST';
  }
  process.env.CURRENT_ENV = env;

  target = './' + target;
  if (target && _.contains(utils, target)) {
    grunt.option('stack', true);
    grunt.log.writeln();
    var options = qs.parse(args) || {};
    require(target)(options, function(err, response) {
      if (err) {
        grunt.log.error(err);
        done(false);
      } else {
        if (response) {
          grunt.log.writeln(response);
        }
        done();
      }
    });
  } else {
    grunt.log.error('Select one:');
    _.each(utils, function(item) {
      grunt.log.error(item.replace('./', ''));
    });
    done(false);
  }
};
