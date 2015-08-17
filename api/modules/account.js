'use strict';

var _ = require('underscore'),
  db = require('../components/db'),
  crypto = require('crypto'),
  log = require('./log'),
  timeZones = require('../../data/timezones'),
  constants = require('../components/constants');

var noop = function() {};

var baseNotificationInterval = 5;

// need to old android builds
var userFieldsMap = {
  budgetFrom: 'number',
  budgetTo: 'number',
  daysPosted: 'number',
  notifyInterval: 'number',
  notifyAllow: 'boolean',
  useProxy: 'boolean',
  timezone: 'number'
};

var convertUserFields = function(data) {
  _.each(userFieldsMap, function(value, key) {
    switch (value) {
      case 'number':
        if (!_.isUndefined(data[key]) && !_.isNumber(data[key])) {
          data[key] = Number(data[key]);
        }
        break;
      case 'boolean':
        if (!_.isUndefined(data[key]) && !_.isBoolean(data[key])) {
          data[key] = data[key] === 'true';
        }
        break;
    }
  });
};
// end: need to old android builds

var fillMinutes = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    opts = options || {},
    cb = callback || noop,
    userid = opts.userid,
    interval = Number(opts.interval) || baseNotificationInterval,
    prevInterval = Number(opts.prevInterval),
    timezone = String(opts.timezone),
    prevTimezone = opts.prevTimezone,
    dndFrom,
    dndTo,
    disable = opts.disable,
    timeReg = /\d{2}:\d{2}/,
    multiStack = [],
    timestamp = new Date().getTime();

  workflow.on('validateParams', function() {
    var errors = [];
    if (!userid) {
      errors.push(constants.get('REQUIRED', 'userid'));
    }
    if (!_.contains(timeZones, timezone)) {
      errors.push(constants.get('WRONG_TIMEZONE'));
    }
    if (errors.length) {
      cb(errors);
    } else {
      workflow.emit('fillMinutes');
    }
  });

  workflow.on('fillMinutes', function() {
    var minutesDND = function(dndTime) {
      if (!timeReg.test(dndTime)) {
        return null;
      }
      dndTime = dndTime.split(':');
      return Number(dndTime[0]) * 60 + Number(dndTime[1]);
    };
    dndFrom = minutesDND(opts.dndFrom);
    dndTo = minutesDND(opts.dndTo);

    var generateStack = function(interval, rem) {
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
    };

    if (disable) {
      generateStack(interval, true);
    } else {
      if (prevInterval || prevTimezone) {
        generateStack(prevInterval || interval, true);
      }

      generateStack(interval);
    }
    db.multi(multiStack, function(err) {
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

// ----------------
// public functions
// ----------------

var pCreate = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback || noop,
    opts = options ? _.clone(options) : {},
    token = opts.id,
    userid,
    requiredFields = [
      'id',
      'os',
      'budgetFrom',
      'budgetTo',
      'daysPosted',
      'duration',
      'jobType',
      'workload',
      'notifyInterval',
      'notifyAllow',
      'dndFrom',
      'dndTo',
      'useProxy',
      'timezone'
    ];

  workflow.on('validateParams', function() {
    var errors = [];
    _.each(requiredFields, function(item) {
      if (_.isUndefined(opts[item])) {
        errors.push(constants.get('REQUIRED', item));
      }
    });
    if (errors.length) {
      cb(errors);
    } else {
      workflow.emit('generateUserId');
    }
  });

  workflow.on('generateUserId', function() {
    var md5sum = crypto.createHash('md5');
    md5sum.update(token);
    userid = md5sum.digest('hex');
    workflow.emit('checkUser');
  });

  workflow.on('checkUser', function() {
    db.hget('users', userid, function(err, response) {
      if (err) {
        cb(err);
      } else if (response) {
        cb(null, {
          userid: userid
        });
      } else {
        workflow.emit('saveUser');
      }
    });
  });

  workflow.on('saveUser', function() {
    convertUserFields(opts);
    _.each(opts, function(value, key) {
      if (!_.isNumber(value) && !_.isBoolean(value)) {
        opts[key] = _.escape(value);
      }
    });
    var userInfo = _.extend(opts, {
      id: userid,
      push_id: token,
      notifications: false, // it's not notifyAllow
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
    opts = options ? _.clone(options) : {},
    userid = opts.id,
    userinfo,
    requiredFields = [
      'id',
      'os',
      'budgetFrom',
      'budgetTo',
      'daysPosted',
      'duration',
      'jobType',
      'workload',
      'notifyInterval',
      'notifyAllow',
      'dndFrom',
      'dndTo',
      'useProxy',
      'timezone'
    ];

  workflow.on('validateParams', function() {
    var errors = [];
    _.each(requiredFields, function(item) {
      if (_.isUndefined(opts[item])) {
        errors.push(constants.get('REQUIRED', item));
      }
    });
    if (errors.length) {
      cb(errors);
    } else {
      convertUserFields(opts);
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

    if (opts.notifyAllow === false && userinfo.notifyAllow === true && userinfo.feeds) {
      // if user disable notifications when it was enabled
      _.extend(fmOpts, {
        disable: true,
        interval: userinfo.notifyInterval,
        timezone: userinfo.timezone || opts.timezone
      });
      fill();
      userinfo.notifications = false;
    } else if (feeds && opts.notifyAllow === true && (userinfo.notifyAllow === false || userinfo.notifyInterval !== opts.notifyInterval || (!userinfo.feeds && opts.feeds) || dndFrom !== userinfo.dndFrom || dndTo !== userinfo.dndTo || opts.timezone !== userinfo.timezone)) {
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
    } else if (feeds && userinfo.notifications === false && opts.notifyAllow === true) {
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
      fillMinutes(fmOpts, function() {
        workflow.emit('updateUserInfo');
      });
    }
  });

  workflow.on('updateUserInfo', function() {
    _.each(opts, function(value, key) {
      if (!_.isNumber(value) && !_.isBoolean(value)) {
        opts[key] = _.escape(value);
      }
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

var pFillMinutes = function(options, callback) { // made public for tests
  fillMinutes(options, callback);
};

var pGet = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback || noop,
    opts = options || {},
    userid = opts.id,
    userinfo;

  workflow.on('validateParams', function() {
    if (!userid) {
      cb(constants.get('REQUIRED', 'id'));
    } else {
      workflow.emit('getUser');
    }
  });

  workflow.on('getUser', function() {
    db.hget('users', userid, function(err, response) {
      if (err) {
        cb(err);
      } else if (!response) {
        cb(constants.get('USER_NOT_FOUND'));
      } else {
        userinfo = response;
        workflow.emit('getMinutes');
      }
    });
  });

  workflow.on('getMinutes', function() {
    var multiStack = [],
      i = 0,
      l = 1440; // minutes per day

    for (; i < l; i += baseNotificationInterval) {
      if (i === 0) {
        continue;
      }
      multiStack.push({
        minute: userinfo.timezone + ':' + i,
        operation: 'zscore',
        topic: 'time:' + userinfo.timezone + ':' + i,
        id: userid
      });
    }
    db.multi(multiStack, function(err, response) {
      if (err) {
        cb(err);
      } else {
        var result = [];
        _.each(response, function(value, key) {
          if (value) {
            result.push(multiStack[key].minute);
          }
        });
        userinfo.notificationsMinutes = result;
        cb(null, userinfo);
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
  fillMinutes: pFillMinutes,
  get: pGet,
  disableNotifications: pDisableNotifications
};
