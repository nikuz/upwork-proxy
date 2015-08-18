'use strict';

var debug = require('../modules/debug');

// ----------------
// public functions
// ----------------

var pStore = function(req, res) {
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
};

var pGet = function(req, res) {
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
};

// ---------
// interface
// ---------

exports = module.exports = {
  store: pStore,
  get: pGet
};
