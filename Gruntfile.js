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
        'specs/**/*.js'
      ]
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        '*.js',
        'api/**/*.js',
        'specs/**/*.js'
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
};
