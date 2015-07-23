'use strict';

var config = require('../config.json'),
  _ = require('underscore'),
  upwork = require('../modules/upwork'),
  log = require('./log')();

var noop = function() {};

// ----------------
// public functions
// ----------------

var pGet = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback || noop,
    opts = options || {};

  workflow.on('validateParams', function() {
    if (!opts.id) {
      cb('`id` is required');
    } else {
      workflow.emit('getJob');
    }
  });

  workflow.on('getJob', function() {
    upwork.request({
      url: config.API_job_url.replace('{id}', opts.id),
      dataType: 'json'
    }, function(err, response) {
      if (err) {
        cb(err);
        log.captureMessage('Upwork request error', {
          extra: {
            err: err
          }
        });
      } else {
        cb(null, response);
      }
    });
  });

  workflow.emit('validateParams');
};

var pList = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback || noop,
    opts = options || {};

  workflow.on('validateParams', function() {
    if (!opts.q && !opts.title && !opts.skills) {
      cb('`q` or `title` or `skills` required');
    } else {
      workflow.emit('getJobs');
    }
  });

  workflow.on('getJobs', function() {
    _.each(opts, function(item, key) {
      if (_.isUndefined(item)) {
        delete opts[key];
      }
    });
    upwork.request({
      url: config.API_jobs_url,
      dataType: 'json',
      data: opts
    }, function(err, response) {
      if (err) {
        cb(err);
        log.captureMessage('Upwork request error', {
          extra: {
            err: err
          }
        });
      } else {
        cb(null, response);
      }
    });
  });

  workflow.emit('validateParams');
};

// ---------
// interface
// ---------

exports = module.exports = {
  get: pGet,
  list: pList
};
