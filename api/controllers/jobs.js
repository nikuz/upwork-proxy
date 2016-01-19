'use strict';

var _ = require('underscore'),
  config = require('../../config'),
  upwork = require('../modules/upwork'),
  log = require('../modules/log'),
  constants = require('../constants')(),
  EventEmitter = require('events').EventEmitter;

// ----------------
// public functions
// ----------------

function pGet(req, res) {
  var workflow = new EventEmitter(),
    cb = function(err, response) {
      var result = {};
      if (err) {
        result.error = err;
      } else {
        result = response;
      }
      res.send(result);
    },
    jobid = req.params.id;

  workflow.on('validateParams', function() {
    if (!jobid) {
      cb(constants.REQUIRED('id'));
    } else {
      workflow.emit('getJob');
    }
  });

  workflow.on('getJob', function() {
    upwork.request({
      url: config.API_job_url.replace('{id}', jobid)
    }, function(err, response) {
      if (err) {
        cb(err);
      } else {
        try {
          JSON.parse(response);
        } catch (e) {
          log.captureMessage('Upwork is down');
          response = 'upwork_is_down';
        }
        cb(null, response);
      }
    });
  });

  workflow.emit('validateParams');
}

function pList(req, res) {
  var workflow = new EventEmitter(),
    cb = function(err, response) {
      var result = {};
      if (err) {
        result.error = err;
      } else {
        result = response;
      }
      res.send(result);
    },
    opts = {
      q: req.query.q,
      category2: req.query.category2,
      title: req.query.title,
      skills: req.query.skills,
      budget: req.query.budget,
      days_posted: req.query.days_posted,
      duration: req.query.duration,
      job_type: req.query.job_type,
      workload: req.query.workload,
      paging: req.query.paging,
      sort: req.query.sort
    };

  workflow.on('validateParams', function() {
    if (!opts.q && !opts.title && !opts.skills) {
      cb(constants.ONE_REQUIRED(['q', 'title', 'skills']));
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
        try {
          JSON.parse(response);
        } catch (e) {
          log.captureMessage('Upwork is down');
          response = 'upwork_is_down';
        }
        cb(null, response);
      }
    });
  });

  workflow.emit('validateParams');
}

function pCategoriesList(req, res) {
  upwork.request({
    url: config.API_jobs_categories_url
  }, function(err, response) {
    var result = {};
    if (err) {
      result.error = err;
    } else {
      result = response;
    }
    res.send(result);
  });
}

// ---------
// interface
// ---------

exports = module.exports = {
  get: pGet,
  list: pList,
  categoriesList: pCategoriesList
};
