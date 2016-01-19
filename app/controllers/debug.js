'use strict';

var debug = require('../models/debug');

// ----------------
// public functions
// ----------------

function pStore(req, res) {
  var body = req.body || {};
  debug.store({
    userid: req.params.userid,
    data: body.data
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

function pGet(req, res) {
  debug.get({
    userid: req.params.userid
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
  store: pStore,
  get: pGet
};
