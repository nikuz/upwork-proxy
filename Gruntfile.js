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
        'app/**/*.js',
        'specs/**/*.js',
        'tests/**/*.js',
        'utils/**/*.js'
      ]
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        '*.js',
        'app/**/*.js',
        'specs/**/*.js',
        'tests/**/*.js',
        'utils/**/*.js'
      ]
    },
    // for specs tests
    mochacov: {
      options: {
        timeout: 1000 * 20,
        reporter: 'spec'
      },
      all: ['specs/index.js']
    },
    // for e2e tests
    express: {
      local: {
        options: {
          script: 'server.js',
          port: 8020
        }
      }
    },
    wait: {
      options: {
        delay: 1000
      },
      pause: {}
    },
    mochaWebdriver: {
      options: {
        timeout: 1000 * 10,
        reporter: 'spec',
        usePromises: true
      },
      phantom: {
        src: ['tests/index.js'],
        options: {
          testName: 'phantom tests',
          usePhantom: true,
          phantomPort: 5555,
          browsers: []
        }
      }
    }
    // end: for e2e tests
  });

  require('load-grunt-tasks')(grunt);
  grunt.loadNpmTasks('grunt-express-server');
  grunt.loadNpmTasks('grunt-wait');
  grunt.loadNpmTasks('grunt-mocha-webdriver');

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

  grunt.registerTask('e2e', function() {
    var target = grunt.option('target');
    if (target) {
      process.env.TEST_TARGET = target;
    }
    grunt.task.run(['express:local', 'wait:pause', 'mochaWebdriver:phantom']);
  });

  grunt.registerTask('utils', function() {
    var done = this.async(),
      target = grunt.option('target'),
      env = grunt.option('env'),
      args = grunt.option('args');

    require('./utils/index')(grunt, done, env, target, args);
  });
};
