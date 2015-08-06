'use strict';

var jobs = require('../modules/jobs');


// ----------------
// public functions
// ----------------

var pGet = function(req, res) {
  jobs.get({
    id: req.params.id
  }, function(err, response) {
    var result = {};
    if (err) {
      result.error = err;
    } else {
      result = response;
    }
    res.send(result);
  });
};

var pList = function(req, res) {
  jobs.list({
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
  }, function(err, response) {
    var result = {};
    if (err) {
      result.error = err;
    } else {
      result = response;
    }
    res.send(result);
  });
};

var pCategoriesList = function(req, res) {
  jobs.categoriesList({}, function(err, response) {
    var result = {};
    if (err) {
      result.error = err;
    } else {
      result = response;
    }
    res.send(result);
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
