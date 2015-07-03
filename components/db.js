'use strict';

var _ = require('underscore'),
  async = require('async'),
  config = require('../config.json'),
  redis = require('redis'),
  db = redis.createClient(),
  dbPrefix = config.db_prefix;

var noop = function() {};

var getMembersScores = function(members) {
  var scoresList = _.groupBy(members, function(a, b) {
      return Math.floor(b / 2);
    }),
    scores = {},
    names = [];
  _.each(scoresList, function(item) {
    scores[item[0]] = parseInt(item[1], 10);
    names.push(item[0]);
  });
  return {
    names: names,
    scores: scores
  };
};

var getMembers = function(topic, members, options, callback) {
  var opts = options || {},
    showAll = opts.per_page === 0,
    page = showAll ? 1 : (opts.page || 1),
    per_page = showAll ? 'all' : (opts.per_page || 20),
    total = opts.total,
    start = showAll ? 0 : (opts.start || 0),
    rank = start + 1,
    membersData = getMembersScores(members);

  db.hmget(dbPrefix + topic, membersData.names, function(err, data) {
    var items = [],
      result = {};
    _.each(data, function(member) {
      var current = JSON.parse(member);
      if (current) {
        current.rank = rank;
        current.score = membersData.scores[current.id];
        items.push(current);
      }
      rank += 1;
    });
    result.page = page;
    result.per_page = per_page;
    result.total = total;
    result.count = items.length;
    result.items = items;
    if (callback) {
      callback(null, result);
    }
  });
};

var muilti = function(operations, meta, callback) {
  var cb = callback || noop,
    multi = db.multi(),
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
        multi[operationType](topic, oItem.id);
        break;
      case 'hgetall':
        multi[operationType](topic);
        break;
      case 'hset':
        multi[operationType](topic, oItem.id, oItem.data);
        break;
      case 'hlen':
        multi[operationType](topic);
        break;
      case 'hdel':
        multi[operationType](topic, oItem.id);
        break;
      case 'zadd':
        multi[operationType](topic, oItem.score, oItem.id);
        break;
      case 'zrem':
        multi[operationType](topic, oItem.id);
        break;
      case 'zincrby':
        multi[operationType](topic, oItem.score || 1, oItem.id);
        break;
      case 'zcount':
        multi[operationType](topic, '-inf', '+inf');
        break;
      case 'zrange':
        multi[operationType](topic, oItem.start, oItem.end);
        break;
      case 'del':
        multi[operationType](topic);
        break;
      default:
    }
  });
  multi.exec(cb);
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
  var cb = callback || noop;
  db.zrem(dbPrefix + 'z:' + topic, id, function(err) {
    cb(err);
  });
};

var pZadd = function(topic, score, id, callback) {
  var cb = callback || noop;
  db.zadd(dbPrefix + 'z:' + topic, score, id, function(err) {
    cb(err);
  });
};

var pZall = function(topic, callback) {
  var cb = callback || noop;
  db.zrevrange(dbPrefix + 'z:' + topic, 0, -1, cb);
};

var pIntersection = function(topics, metatopic, options, callback) {
  var cb = callback || noop,
    opts = options || {},
    showAll = opts.per_page === 0,
    start = showAll ? 0 : (opts.start || 0),
    end = showAll ? -1 : (_.isUndefined(opts.end) ? opts.end : 19),
    weights = opts.weights,
    tags = [],
    cmd,
    orderFunction;
  if (_.isArray(topics) && topics.length && metatopic) {
    _.each(topics, function(topic) {
      tags.push(dbPrefix + 'z:' + topic);
    });
    var tmp = 'tmp:intersection:' + new Date().getTime();
    cmd = [dbPrefix + tmp, tags.length].concat(tags);
    if (_.isArray(weights) && weights.length === topics.length) {
      cmd = cmd.concat('weights', weights);
    }
    db.ZINTERSTORE(cmd, function(err, total) {
      if (err) {
        cb(err);
      } else {
        orderFunction = opts.ascending ? 'zrange' : 'zrevrange';
        db[orderFunction](dbPrefix + tmp, start, end, 'withscores', function(err, members) {
          if (err) {
            cb(err);
          } else {
            opts.total = parseInt(total, 10);
            getMembers(metatopic, members, opts, cb);
          }
          db.del(dbPrefix + tmp);
        });
      }
    });
  } else {
    cb(true, null);
  }
};

var pCounter = function(key, callback) {
  var cb = callback || noop;
  db.incr(dbPrefix + key, cb);
};

var pFlushall = function(callback) {
  var cb = callback || noop;
  db.keys(dbPrefix + '*', function(err, keys) {
    async.eachSeries(keys, function(key, internalCallback) {
      db.del(key, internalCallback);
    }, function(err) {
      cb(err);
    });
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
  zrem: pZrem,
  zall: pZall,
  intersection: pIntersection,
  counter: pCounter,
  flushall: pFlushall
};

