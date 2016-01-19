'use strict';

var _ = require('underscore'),
  db = require('../db'),
  crypto = require('crypto'),
  constants = require('../constants')(),
  validator = require('../modules/validator'),
  EventEmitter = require('events').EventEmitter,
  cacheTTL = 1000 * 60 * 5; // 5 minutes;

if (process.env.CURRENT_ENV === 'TEST') {
  cacheTTL = 3; // 3 seconds
}

// ----------------
// public functions
// ----------------

function pGetId(options) {
  if (!_.isObject(options) || !_.size(options)) {
    return constants.OBJECT_REQUIRED('options');
  }

  var md5sum = crypto.createHash('md5');
  md5sum.update(JSON.stringify(options));
  return md5sum.digest('hex');
}

function pStore(options, callback) {
  var workflow = new EventEmitter(),
    cb = callback || _.noop,
    opts = options || {},
    id = opts.id,
    data = opts.data;

  workflow.on('validateParams', function() {
    validator.check({
      id: ['string', id],
      data: ['string', data]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('store');
      }
    });
  });

  workflow.on('store', function() {
    db.set(`cache:${id}`, cacheTTL, data, function(err) {
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
    id = opts.id;

  workflow.on('validateParams', function() {
    validator.check({
      id: ['string', id]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('get');
      }
    });
  });

  workflow.on('get', function() {
    db.get(`cache:${id}`, cb);
  });

  workflow.emit('validateParams');
}

// ---------
// interface
// ---------

exports = module.exports = {
  getId: pGetId,
  store: pStore,
  get: pGet
};
