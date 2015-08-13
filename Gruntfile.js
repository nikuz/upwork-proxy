'use strict';

var dump = require('redis-dump'),
  exec = require('child_process').exec;

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
        'components/**/*.js',
        'controllers/**/*.js',
        'modules/**/*.js',
        'specs/**/*.js'
      ]
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        '*.js',
        'components/**/*.js',
        'controllers/**/*.js',
        'modules/**/*.js',
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

  var dumpFile = '/data/bd.dump';
  grunt.registerTask('db:dump', function() {
    var done = this.async();
    dump({
      filter: 'upwork-mobile:*'
    }, function(err, response) {
      if (err) {
        grunt.log.error(err);
      } else {
        grunt.file.write(__dirname + dumpFile, response);
        grunt.log.writeln(dumpFile);
      }
      done();
    });
  });
  grunt.registerTask('db:restore', function() {
    var done = this.async();
    exec('cat ' + (__dirname + dumpFile) + ' | redis-cli', function(err) {
      if (err) {
        grunt.log.error(err);
      } else {
        grunt.log.writeln('Done!');
      }
      done();
    });
  });
};
