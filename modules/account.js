'use strict';

var _ = require('underscore'),
  db = require('../components/db'),
  crypto = require('crypto');

var noop = function() {};

var fillMinutes = function(options, callback) {
  var opts = options || {},
    cb = callback || noop,
    userid = opts.userid,
    interval = Number(opts.interval),
    prevInterval = Number(opts.prevInterval),
    disable = opts.disable,
    timeReg = /\d{2}:\d{2}/,
    dndFrom = minutesDND(opts.dndFrom),
    dndTo = minutesDND(opts.dndTo),
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
      // if generate stack to add minutes
      // and we have "Do not disturb" interval
      // if start hour less than stop hour, exclude time interval between start and stop
      // otherwise exclude all minutes more than start and less than stop
      if (!rem && !_.isNull(dndFrom) && !_.isNull(dndTo) && ((dndFrom < dndTo && i > dndFrom && i < dndTo) || (dndFrom > dndTo && i > dndFrom || i < dndTo))) {
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

  function minutesDND(dndTime) {
    if (!timeReg.test(dndTime)) {
      return null;
    }
    dndTime = dndTime.split(':');
    return Number(dndTime[0]) * 60 + Number(dndTime[1]);
  }
};

// ----------------
// public functions
// ----------------

var pCreate = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback || noop,
    opts = options || {},
    token = opts.id,
    os = opts.os,
    userid;

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
      workflow.emit('generateUser');
    }
  });

  workflow.on('generateUser', function() {
    var md5sum = crypto.createHash('md5');
    md5sum.update(token);
    userid = md5sum.digest('hex');
    workflow.emit('checkUser');
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
      id: userid,
      push_id: token,
      os: os,
      created: new Date().toISOString()
    });
    db.hset('users', userid, userInfo, function(err) {
      if (err) {
        cb(err);
      } else {
        cb(null, {
          userid: userid
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
    userid = opts.id,
    userinfo;

  workflow.on('validateParams', function() {
    var keys = _.keys(opts);
    _.each(keys, function(key) {
      if (_.isUndefined(opts[key])) {
        delete opts[key];
      }
    });
    workflow.emit('checkUser');
  });

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
    var feeds = opts.feeds || userinfo.feeds,
      dndFrom = opts.dndFrom,
      dndTo = opts.dndTo,
      fmOpts = {
        userid: userid
      };

    // if user disable notifications when it was enabled
    if (opts.notifyAllow === 'false' && userinfo.notifyAllow === 'true' && userinfo.feeds) {
      _.extend(fmOpts, {
        disable: true,
        interval: userinfo.notifyInterval
      });
      fill();
      // if user initial add feeds
      // or change notification interval
      // or enable notifications when it was disabled
      // or user change "Do not disturb" interval
    } else if (feeds && opts.notifyAllow === 'true' && (userinfo.notifyAllow === 'false' || userinfo.notifyInterval !== opts.notifyInterval || (!userinfo.feeds && opts.feeds) || dndFrom !== userinfo.dndFrom || dndTo !== userinfo.dndTo)) {
      _.extend(fmOpts, {
        prevInterval: userinfo.notifyInterval,
        interval: opts.notifyInterval,
        dndFrom: dndFrom,
        dndTo: dndTo
      });
      fill();
    } else {
      workflow.emit('updateUserInfo');
    }

    function fill() {
      fillMinutes(fmOpts, function(err) {
        if (err) {
          cb(err);
        } else {
          workflow.emit('updateUserInfo');
        }
      });
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
      if (userinfo.feeds) {
        userinfo.prevFeeds.push(userinfo.feeds);
      }
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

  workflow.emit('validateParams');
};

// ---------
// interface
// ---------

exports = module.exports = {
  create: pCreate,
  update: pUpdate
};
