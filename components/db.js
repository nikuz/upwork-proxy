'use strict';

var _ = require('underscore'),
  config = require('../config.json'),
  redis = require('redis'),
  db = redis.createClient(),
  dbPrefix = config.db_prefix;

var noop = function() {};

var muilti = function(operations, meta, callback) {
  var cb = callback || noop,
    operationsMap = {
      hget: 'hget',
      hgetall: 'hgetall',
      hset: 'hset',
      hlen: 'hlen',
      hrem: 'hdel',
      zadd: 'zadd',
      zrem: 'zrem',
      zincrby: 'zincrby',
      zcount: 'zcount',
      zrange: 'zrange',
      del: 'del'
    };

  if (!_.isArray(operations)) {
    cb(constants.keys.ARRAY_REQUIRED, null);
    return;
  }

  _.each(operations, function(oItem) {
    var operationType = operationsMap[oItem.operation];

    if (!operationType) {
      cb(constants.keys.METHOD_NOT_EXIST);
      return;
    }

    var topicPrefix = '';
    if (!meta) {
      topicPrefix = (operationType === 'del' ? 'z' : operationType.substr(0, 1)) + ':';
    }
    var topic = dbPrefix + topicPrefix + oItem.topic;

    switch (operationType) {
      case 'hget':
        db.multi[operationType](topic, oItem.id);
        break;
      case 'hgetall':
        db.multi[operationType](topic);
        break;
      case 'hset':
        db.multi[operationType](topic, oItem.id, oItem.data);
        break;
      case 'hlen':
        db.multi[operationType](topic);
        break;
      case 'hdel':
        db.multi[operationType](topic, oItem.id);
        break;
      case 'zadd':
        db.multi[operationType](topic, oItem.score, oItem.id);
        break;
      case 'zrem':
        db.multi[operationType](topic, oItem.id);
        break;
      case 'zincrby':
        db.multi[operationType](topic, oItem.score || 1, oItem.id);
        break;
      case 'zcount':
        db.multi[operationType](topic, '-inf', '+inf');
        break;
      case 'zrange':
        db.multi[operationType](topic, oItem.start, oItem.end);
        break;
      case 'del':
        db.multi[operationType](topic);
        break;
      default:
    }
  });
  db.multi.exec(cb);
};

db.on("error", function (err) {
  console.log("DB Error: " + err);
});

// ----------------
// public functions
// ----------------

var pMulti = function(operations, callback) {
  muilti(operations, false, callback);
};

var pMetaMulti = function(operations, callback) {
  muilti(operations, true, callback);
};

var pHget = function(topic, id, callback) {
  var cb = callback || noop;
  if (topic && id) {
    db.hget(dbPrefix + topic, id, function(err, reply) {
      cb(err, err ? reply : JSON.parse(reply));
    });
  } else {
    cb(true, null);
  }
};

var pHset = function(topic, id, data, callback) {
  var cb = callback || noop;
  if (topic && id && data) {
    db.hset(dbPrefix + topic, id, JSON.stringify(data), function(err, reply) {
      cb(err, reply);
    });
  } else {
    cb(true, null);
  }
};

var pZrem = function(topic, id, callback) {
  db.zrem(dbPrefix + 'z:' + topic, id, function(err) {
    callback(err);
  });
};

var pZadd = function(topic, score, id, callback) {
  db.zadd(dbPrefix + 'z:' + topic, score, id, function(err) {
    callback(err);
  });
};

// ---------
// interface
// ---------

exports = module.exports = {
  multi: pMulti,
  metaMulti: pMetaMulti,
  hget: pHget,
  hset: pHset,
  zadd: pZadd,
  zrem: pZrem
};

