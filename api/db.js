'use strict';

var _ = require('underscore'),
  async = require('async'),
  config = require('../config'),
  log = require('./modules/log'),
  constants = require('./constants')(),
  redis = require('redis'),
  dbPrefix = config.db_prefix,
  db,
  dbConnected;

if (!db) {
  var address = '127.0.0.1',
    port = 6379,
    password = '';

  switch (process.env.CURRENT_ENV) {
    case 'PROD':
      password = process.env.REDIS_PASSWORD;
      break;
    case 'DEV':
      address = config.db_remote_host;
      password = process.env.REDIS_PASSWORD;
      break;
  }
  db = redis.createClient(port, address);
  db.auth(password);

  db.on('error', function(err) {
    console.log('Redis ' + err);
    if (!dbConnected) {
      process.exit(1);
    }
  });
  db.on('ready', function() {
    dbConnected = true;
    console.log('Redis connected: %s:%d', address, port);
  });
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

db.on('error', function(err) {
  log.captureMessage(constants.DATABASE_ERROR(), {
    extra: {
      err: err
    }
  });
});

// ----------------
// public functions
// ----------------

var pMulti = function(operations, callback) {
  var cb = callback || noop,
    multi = db.multi();

  if (!_.isArray(operations)) {
    cb(constants.ARRAY_REQUIRED('operations'));
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
      case 'zscore':
        multi[operation](topic, oItem.id);
        break;
      case 'del':
        multi[operation](topic);
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

var pHgetall = function(topic, callback) {
  var cb = callback || noop;
  if (topic) {
    db.hgetall(dbPrefix + topic, cb);
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
  if (process.env.CURRENT_ENV !== 'TEST') {
    console.log('Can\'t flush `%` db. Flush operation available only for `TEST` environment.', process.env.CURRENT_ENV);
    cb(true);
  } else {
    db.keys(dbPrefix + '*', function(err, keys) {
      async.eachSeries(keys, function(key, internalCallback) {
        db.del(key, internalCallback);
      }, function(err) {
        cb(err);
      });
    });
  }
};

// ---------
// interface
// ---------

exports = module.exports = {
  multi: pMulti,
  hget: pHget,
  hset: pHset,
  hgetall: pHgetall,
  zadd: pZadd,
  zrem: pZrem,
  zall: pZall,
  union: pUnion,
  counter: pCounter,
  flushall: pFlushall
};

