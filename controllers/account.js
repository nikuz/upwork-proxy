'use strict';

var account = require('../modules/account');


// ----------------
// public functions
// ----------------

var pCreate = function(req, res) {
  var body = req.body || {};
  account.create({
    id: body.id,
    budgetFrom: body.budgetFrom,
    budgetTo: body.budgetTo,
    daysPosted: body.daysPosted,
    duration: body.duration,
    jobType: body.jobType,
    workload: body.workload,
    notifyInterval: body.notifyInterval,
    notifyDisabled: body.notifyDisabled,
    useProxy: body.useProxy
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
    userid: req.params.userid,
    feeds: body.feeds,
    budgetFrom: body.budgetFrom,
    budgetTo: body.budgetTo,
    daysPosted: body.daysPosted,
    duration: body.duration,
    jobType: body.jobType,
    workload: body.workload,
    notifyInterval: body.notifyInterval,
    notifyDisabled: body.notifyDisabled,
    useProxy: body.useProxy
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
