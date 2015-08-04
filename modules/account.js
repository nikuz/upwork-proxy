'use strict';

var _ = require('underscore'),
  db = require('../components/db'),
  crypto = require('crypto'),
  log = require('./log')(),
  timeZones = require('../data/timezones');

var noop = function() {};

var fillMinutes = function(options, callback) {
  var opts = options || {},
    cb = callback || noop,
    userid = opts.userid,
    interval = Number(opts.interval),
    prevInterval = Number(opts.prevInterval),
    timezone = opts.timezone,
    prevTimezone = opts.prevTimezone,
    disable = opts.disable,
    timeReg = /\d{2}:\d{2}/,
    dndFrom = minutesDND(opts.dndFrom),
    dndTo = minutesDND(opts.dndTo),
    multiStack = [],
    timestamp = new Date().getTime();

  if (_.contains(timeZones, timezone)) {
    if (disable) {
      generateStack(interval, true);
    } else {
      if (prevInterval || prevTimezone) {
        generateStack(prevInterval || interval, true);
      }

      generateStack(interval);
    }
    db.multi(multiStack, cb);
  } else {
    log.captureMessage('Nonexistent time zone', {
      extra: {
        timezone: timezone
      }
    });
    cb('Nonexistent time zone');
  }

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
      if (!rem && !_.isNull(dndFrom) && !_.isNull(dndTo) && ((dndFrom < dndTo && i > dndFrom && i < dndTo) || (dndFrom > dndTo && (i > dndFrom || i < dndTo)))) {
        continue;
      }
      multiStack.push({
        operation: rem ? 'zrem' : 'zadd',
        topic: 'time:' + (rem ? prevTimezone || timezone : timezone) + ':' + i,
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
        cb(null, {
          userid: userid
        });
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
      notifications: false,
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

    if (opts.notifyAllow === 'false' && userinfo.notifyAllow === 'true' && userinfo.feeds) {
      // if user disable notifications when it was enabled
      _.extend(fmOpts, {
        disable: true,
        interval: userinfo.notifyInterval,
        timezone: userinfo.timezone || opts.timezone
      });
      fill();
      userinfo.notifications = false;
    } else if (feeds && opts.notifyAllow === 'true' && (userinfo.notifyAllow === 'false' || userinfo.notifyInterval !== opts.notifyInterval || (!userinfo.feeds && opts.feeds) || dndFrom !== userinfo.dndFrom || dndTo !== userinfo.dndTo || opts.timezone !== userinfo.timezone)) {
      // if user initial add feeds
      // or changed notification interval
      // or enabled notifications when it was disabled
      // or changed "Do not disturb" interval
      // or changed user's timezone
      _.extend(fmOpts, {
        prevInterval: userinfo.notifyInterval,
        interval: opts.notifyInterval,
        timezone: opts.timezone,
        prevTimezone: opts.timezone !== userinfo.timezone ? userinfo.timezone : null,
        dndFrom: dndFrom,
        dndTo: dndTo
      });
      fill();
      userinfo.notifications = true;
    } else if (feeds && userinfo.notifications === false && opts.notifyAllow === 'true') {
      // if user long time don't use the APP, and then again opens it
      _.extend(fmOpts, {
        interval: opts.notifyInterval,
        timezone: opts.timezone,
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

var pDisableNotifications = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback || noop,
    opts = options || {},
    userid = opts.userid,
    userinfo;

  workflow.on('validateParams', function() {
    if (!userid) {
      cb('`userid` is required');
    } else {
      workflow.emit('checkUser');
    }
  });

  workflow.on('checkUser', function() {
    db.hget('users', userid, function(err, response) {
      if (err) {
        cb(err);
      } else if(!response) {
        cb('User not found');
      } else {
        userinfo = response;
        workflow.emit('disableNotifications');
      }
    });
  });

  workflow.on('disableNotifications', function() {
    fillMinutes({
      userid: userid,
      interval: userinfo.notifyInterval,
      timezone: userinfo.timezone || '0',
      disable: true
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('saveUserInfo');
      }
    });
  });

  workflow.on('saveUserInfo', function() {
    userinfo.notifications = false;
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
  update: pUpdate,
  disableNotifications: pDisableNotifications
};
