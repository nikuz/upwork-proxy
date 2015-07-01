'use strict';

var config = require('../config.json'),
  _ = require('underscore'),
  upwork = require('../modules/upwork'),
  email = require('../modules/email')();

var noop = function() {};

// ----------------
// public functions
// ----------------

var pList = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback || noop,
    opts = options || {};

  workflow.on('validateParams', function() {
    if (!opts.q) {
      cb('`q` required');
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
        email.send(config.admin_email, 'Upwork request error', err);
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
  list: pList
};
