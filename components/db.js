'use strict';

var _ = require('underscore'),
  async = require('async'),
  config = require('../config.json'),
  redis = require('redis'),
  dbPrefix = config.db_prefix,
  db;

if (!db) {
  db = redis.createClient();
}

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

db.on("error", function (err) {
  console.log("DB Error: " + err);
});

// ----------------
// public functions
// ----------------

var pMulti = function(operations, callback) {
  var cb = callback || noop,
    multi = db.multi();

  if (!_.isArray(operations)) {
    cb(constants.keys.ARRAY_REQUIRED, null);
    return;
  }

  _.each(operations, function(oItem) {
    var operation = oItem.operation,
      topic = dbPrefix + 'z:' + oItem.topic;

    switch (operation) {
      case 'zadd':
        multi[operation](topic, oItem.score, oItem.id);
        break;
      case 'zrem':
        multi[operation](topic, oItem.id);
        break;
    }
  });
  multi.exec(cb);
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

var pUnion = function(topics, metatopic, callback) {
  var cb = callback || noop,
    opts = {},
    tags = [],
    cmd,
    tmp = 'tmp:union:' + new Date().getTime();

  if (_.isArray(topics) && metatopic) {
    _.each(topics, function(topic) {
      tags.push(dbPrefix + 'z:' + topic);
    });
    cmd = [dbPrefix + tmp, tags.length].concat(tags);
    db.zunionstore(cmd, function(err, total) {
      if (err) {
        cb(err);
      } else {
        db.zrange(dbPrefix + tmp, 0, -1, 'withscores', function(err, members) {
          opts.total = parseInt(total, 10);
          getMembers(metatopic, members, opts, cb);
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
  hget: pHget,
  hset: pHset,
  zadd: pZadd,
  zrem: pZrem,
  zall: pZall,
  union: pUnion,
  counter: pCounter,
  flushall: pFlushall
};

