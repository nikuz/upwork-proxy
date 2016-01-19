'use strict';

var _ = require('underscore'),
  config = require('../../config'),
  upwork = require('../modules/upwork'),
  log = require('../modules/log'),
  validator = require('../modules/validator'),
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
    token = req.query.token,
    token_secret = req.query.token_secret,
    jobid = req.params.id;

  workflow.on('validateParams', function() {
    validator.check({
      jobid: ['string', jobid],
      token: ['string', token],
      token_secret: ['string', token_secret]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('getJob');
      }
    });
  });

  workflow.on('getJob', function() {
    upwork.request({
      url: config.API_job_url.replace('{id}', jobid),
      token,
      token_secret
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
    token = req.query.token,
    token_secret = req.query.token_secret,
    searchValue = req.query.q || req.query.title || req.query.skills,
    data = {
      category2: req.query.category2,
      budget: req.query.budget,
      duration: req.query.duration,
      job_type: req.query.job_type,
      workload: req.query.workload,
      paging: req.query.paging,
      sort: req.query.sort
    };

  workflow.on('validateParams', function() {
    validator.check({
      searchValue: ['string', searchValue],
      token: ['string', token],
      token_secret: ['string', token_secret]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('getJobs');
      }
    });
  });

  workflow.on('getJobs', function() {
    _.each(data, function(item, key) {
      if (_.isUndefined(item)) {
        delete data[key];
      }
    });
    var searchField = 'q';
    if (req.query.title) {
      searchField = 'title';
    } else if (req.query.skills) {
      searchField = 'skills';
    }
    data[searchField] = searchValue;
    upwork.request({
      url: config.API_jobs_url,
      token,
      token_secret,
      data
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
