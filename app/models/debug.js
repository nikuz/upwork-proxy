'use strict';

var _ = require('underscore'),
  db = require('../db'),
  account = require('./account'),
  validator = require('../modules/validator'),
  EventEmitter = require('events').EventEmitter;

// ----------------
// public functions
// ----------------

function pStore(options, callback) {
  var workflow = new EventEmitter(),
    cb = callback || _.noop,
    opts = options || {},
    userid = opts.userid,
    data = opts.data;

  workflow.on('validateParams', function() {
    validator.check({
      userid: ['string', userid, function(internalCallback) {
        account.get({
          userid
        }, internalCallback);
      }],
      data: ['object', data]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('store');
      }
    });
  });

  workflow.on('store', function() {
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
}

function pGet(options, callback) {
  var workflow = new EventEmitter(),
    cb = callback || _.noop,
    opts = options || {},
    userid = opts.userid;

  workflow.on('validateParams', function() {
    validator.check({
      userid: ['string', userid, function(internalCallback) {
        account.get({
          userid
        }, internalCallback);
      }]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('get');
      }
    });
  });

  workflow.on('get', function() {
    db.hget('users:debug', userid, cb);
  });

  workflow.emit('validateParams');
}

// ---------
// interface
// ---------

exports = module.exports = {
  store: pStore,
  get: pGet
};
