'use strict';

var _ = require('underscore'),
  db = require('../components/db');

var noop = function() {};

var fillMinutes = function(options, callback) {
  var opts = options || {},
    cb = callback || noop,
    userid = opts.userid,
    interval = Number(opts.interval),
    prevInterval = Number(opts.prevInterval),
    disable = opts.disable,
    multiStack = [],
    timestamp = new Date().getTime();

  if (disable) {
    generateStack(interval, true);
  } else {
    if (prevInterval) {
      generateStack(prevInterval, true);
    }

    generateStack(interval);
  }
  db.multi(multiStack, cb);

  function generateStack(interval, rem) {
    var i = 0,
      l = 1440; // minutes per day

    for (; i < l; i += interval) {
      if (i === 0) {
        continue;
      }
      multiStack.push({
        operation: rem ? 'zrem' : 'zadd',
        topic: 'time:' + i,
        id: userid,
        score: timestamp
      });
    }
  }
};

// ----------------
// public functions
// ----------------

var pCreate = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback || noop,
    opts = options || {},
    userid = opts.id;

  workflow.on('validateParams', function() {
    var errors = [];
    _.each(opts, function(field, key) {
      if (_.isUndefined(opts[key])) {
        errors.push(key +' is required');
      }
    });
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
      } else if(response) {
        cb('User already exist');
      } else {
        workflow.emit('saveUser');
      }
    });
  });

  workflow.on('saveUser', function() {
    _.each(opts, function(value, key) {
      opts[key] = _.escape(value);
    });
    var userInfo = _.extend(opts, {
      created: new Date().toISOString()
    });
    db.hset('users', userid, userInfo, function(err) {
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

var pUpdate = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback || noop,
    opts = options || {},
    userid = opts.userid,
    userinfo;

  workflow.on('checkUser', function() {
    db.hget('users', userid, function(err, response) {
      if (err) {
        cb(err);
      } else if(!response) {
        cb('User not found');
      } else {
        userinfo = response;
        workflow.emit('fillMinutes');
      }
    });
  });

  workflow.on('fillMinutes', function() {
    var feeds = opts.feeds || userinfo.feeds;
    // if user disable notifications
    if (opts.notifyAllow === 'false' && userinfo.notifyAllow === 'true' && userinfo.feeds) {
      fillMinutes({
        userid: userid,
        interval: opts.notifyInterval,
        disable: true
      }, function(err) {
        if (err) {
          cb(err);
        } else {
          workflow.emit('updateUserInfo');
        }
      });
      // if user enable notifications
    } else if (feeds && opts.notifyAllow === 'true' && (userinfo.notifyInterval !== opts.notifyInterval || (!userinfo.feeds && opts.feeds) || userinfo.notifyAllow === 'false')) {
      fillMinutes({
        userid: userid,
        interval: opts.notifyInterval,
        prevInterval: userinfo.notifyInterval
      }, function(err) {
        if (err) {
          cb(err);
        } else {
          workflow.emit('updateUserInfo');
        }
      });
    } else {
      workflow.emit('updateUserInfo');
    }
  });

  workflow.on('updateUserInfo', function() {
    _.each(opts, function(value, key) {
      opts[key] = _.escape(value);
    });
    // collect all users feeds for statistics
    if (opts.feeds !== userinfo.feeds && userinfo.feeds !== null) {
      if (!userinfo.prevFeeds) {
        userinfo.prevFeeds = [];
      }
      userinfo.prevFeeds.push(userinfo.feeds);
      userinfo.prevFeeds = _.uniq(userinfo.prevFeeds);
    }
    userinfo = _.extend(userinfo, opts, {
      updated: new Date().toISOString()
    });
    db.hset('users', userid, userinfo, function(err) {
      if (err) {
        cb(err);
      } else {
        cb(null, {
          success: true
        });
      }
    });
  });

  workflow.emit('checkUser');
};

// ---------
// interface
// ---------

exports = module.exports = {
  create: pCreate,
  update: pUpdate
};
