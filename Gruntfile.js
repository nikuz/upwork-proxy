'use strict';

module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jscs: {
      options: {
        preset: 'airbnb',
        config: '.jscsrc'
      },
      src: [
        '*.js',
        'api/**/*.js',
        'specs/**/*.js',
        'utils/**/*.js'
      ]
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        '*.js',
        'api/**/*.js',
        'specs/**/*.js',
        'utils/**/*.js'
      ]
    },
    mochacov: {
      options: {
        timeout: 1000 * 10,
        reporter: 'spec'
      },
      all: ['specs/index.js']
    }
  });

  require('load-grunt-tasks')(grunt);

  grunt.registerTask('before_push_test', [
    'jscs',
    'jshint'
  ]);
  grunt.registerTask('specs', function() {
    var target = grunt.option('target');
    if (target) {
      process.env.SPECS_TARGET = target;
    }
    grunt.task.run(['mochacov']);
  });
  grunt.registerTask('utils', function() {
    var done = this.async(),
      target = grunt.option('target'),
      env = grunt.option('env');

    require('./utils/index')(grunt, done, env, target);
  });
};
