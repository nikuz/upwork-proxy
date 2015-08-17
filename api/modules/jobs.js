'use strict';

var config = require('../../config.json'),
  _ = require('underscore'),
  upwork = require('./upwork'),
  constants = require('../components/constants');

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
      cb(constants.get('REQUIRED', 'id'));
    } else {
      workflow.emit('getJob');
    }
  });

  workflow.on('getJob', function() {
    upwork.request({
      url: config.API_job_url.replace('{id}', opts.id)
    }, function(err, response) {
      if (err) {
        cb(err);
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
      cb(constants.get('ONE_REQUIRED', ['q', 'title', 'skills']));
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
      data: opts
    }, function(err, response) {
      if (err) {
        cb(err);
      } else {
        cb(null, response);
      }
    });
  });

  workflow.emit('validateParams');
};

var pCategoriesList = function(options, callback) {
  var cb = callback || noop;
  upwork.request({
    url: config.API_jobs_categories_url
  }, function(err, response) {
    if (err) {
      cb(err);
    } else {
      cb(null, response);
    }
  });
};

// ---------
// interface
// ---------

exports = module.exports = {
  get: pGet,
  list: pList,
  categoriesList: pCategoriesList
};
