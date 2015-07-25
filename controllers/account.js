'use strict';

var account = require('../modules/account');

// ----------------
// public functions
// ----------------

var pCreate = function(req, res) {
  var body = req.body || {};
  account.create({
    id: body.id,
    os: body.os,
    budgetFrom: body.budgetFrom,
    budgetTo: body.budgetTo,
    daysPosted: body.daysPosted,
    duration: body.duration,
    jobType: body.jobType,
    workload: body.workload,
    notifyInterval: body.notifyInterval,
    notifyAllow: body.notifyAllow,
    dndFrom: body.dndFrom,
    dndTo: body.dndTo,
    useProxy: body.useProxy,
    timezone: body.timezone
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

var pUpdate = function(req, res) {
  var body = req.body || {};
  account.update({
    id: req.params.userid,
    feeds: body.feeds,
    budgetFrom: body.budgetFrom,
    budgetTo: body.budgetTo,
    daysPosted: body.daysPosted,
    duration: body.duration,
    jobType: body.jobType,
    workload: body.workload,
    notifyInterval: body.notifyInterval,
    notifyAllow: body.notifyAllow,
    dndFrom: body.dndFrom,
    dndTo: body.dndTo,
    useProxy: body.useProxy,
    last_job_date: body.last_job_date,
    timezone: body.timezone
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
  create: pCreate,
  update: pUpdate
};
