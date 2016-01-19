'use strict';

var _ = require('underscore'),
  db = require('../db'),
  constants = require('../constants')();

// ----------------
// public functions
// ----------------

var pStore = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback || _.noop,
    opts = options || {},
    userid = opts.userid,
    data = opts.data;

  workflow.on('validateParams', function() {
    var errors = [];
    if (!userid) {
      errors.push(constants.get('REQUIRED', 'userid'));
    }
    if (!data) {
      errors.push(constants.get('REQUIRED', 'data'));
    } else if (!_.isObject(data)) {
      errors.push(constants.get('PARAMETERS_WRONG_FORMAT', '{}'));
    }
    if (errors.length) {
      cb(errors);
    } else {
      workflow.emit('checkUser');
    }
  });

  workflow.on('checkUser', function() {
    db.hget('users', userid, function(err, response) {
      if (err) {
        cb(err);
      } else if (!response) {
        cb(constants.get('USER_NOT_FOUND'));
      } else {
        workflow.emit('storeDebugData');
      }
    });
  });

  workflow.on('storeDebugData', function() {
    db.hset('users:debug', userid, data, function(err) {
      if (err) {
        cb(err);
      } else {
        cb(null, {
          success: true
        });
      }
    });
  });

  workflow.emit('validateParams');
};

var pGet = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback || _.noop,
    opts = options || {},
    userid = opts.userid;

  workflow.on('validateParams', function() {
    if (!userid) {
      cb(constants.get('REQUIRED', 'userid'));
    } else {
      workflow.emit('checkUser');
    }
  });

  workflow.on('checkUser', function() {
    db.hget('users', userid, function(err, response) {
      if (err) {
        cb(err);
      } else if (!response) {
        cb(constants.get('USER_NOT_FOUND'));
      } else {
        workflow.emit('getDebugData');
      }
    });
  });

  workflow.on('getDebugData', function() {
    db.hget('users:debug', userid, cb);
  });

  workflow.emit('validateParams');
};

// ---------
// interface
// ---------

exports = module.exports = {
  store: pStore,
  get: pGet
};
