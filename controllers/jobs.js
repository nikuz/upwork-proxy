'use strict';

var jobs = require('../modules/jobs');


// ----------------
// public functions
// ----------------

var pList = function(req, res) {
  jobs.list({
    q: req.query.q,
    budget: req.query.budget,
    days_posted: req.query.days_posted,
    duration: req.query.duration,
    job_type: req.query.job_type,
    workload: req.query.workload,
    paging: req.query.paging
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

// ---------
// interface
// ---------

exports = module.exports = {
  list: pList
};
