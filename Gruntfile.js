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
        'js/**/*.js',
        'specs/**/*.js'
      ]
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        '*.js',
        'js/**/*.js',
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
  grunt.registerTask('specs', ['mochacov']);
};
