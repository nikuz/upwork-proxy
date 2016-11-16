'use strict';

var _ = require('underscore'),
  db = require('../db'),
  config = require('../../config'),
  crypto = require('crypto'),
  timeZones = require('../../data/timezones'),
  constants = require('../constants')(),
  validator = require('../modules/validator'),
  EventEmitter = require('events').EventEmitter;

const baseNotificationInterval = config.notification_interval;

// ----------------
// public functions
// ----------------

function pCreate(options, callback) {
  var workflow = new EventEmitter(),
    cb = callback || _.noop,
    opts = options || {},
    userid,
    userinfo;

  workflow.on('validateParams', function() {
    validator.check({
      id: ['string', opts.id,  function(internalCallback) {
        // check that user with this id is not exists
        var md5sum = crypto.createHash('md5');
        md5sum.update(opts.id);
        userid = md5sum.digest('hex');
        db.hget('users', userid, function(err, response) {
          if (err) {
            internalCallback(err);
          } else {
            userinfo = response;
            internalCallback();
          }
        });
      }],
      os: ['string', opts.os],
      category2: ['string', opts.category2],
      budgetFrom: ['number', opts.budgetFrom],
      budgetTo: ['number', opts.budgetTo],
      duration: ['string', opts.duration],
      jobType: ['string', opts.jobType],
      workload: ['string', opts.workload],
      notifyInterval: ['number', opts.notifyInterval],
      notifyAllow: ['boolean', opts.notifyAllow],
      dndFrom: ['string', opts.dndFrom],
      dndTo: ['string', opts.dndTo],
      useProxy: ['boolean', opts.useProxy],
      timezone: ['number', opts.timezone]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        if (userinfo) { // already registered
          workflow.emit('loginUpdate');
        } else {
          workflow.emit('create');
        }
      }
    });
  });

  workflow.on('create', function() {
    var timestamp = new Date().toISOString();
    var userInfo = {
      id: userid,
      push_id: opts.id,
      os: opts.os,
      category2: opts.category2,
      budgetFrom: opts.budgetFrom,
      budgetTo: opts.budgetTo,
      duration: opts.duration,
      jobType: opts.jobType,
      workload: opts.workload,
      notifyInterval: opts.notifyInterval,
      notifyAllow: opts.notifyAllow,
      dndFrom: opts.dndFrom,
      dndTo: opts.dndTo,
      useProxy: opts.useProxy,
      timezone: opts.timezone,
      created: timestamp,
      last_logon: timestamp
    };
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

  workflow.on('loginUpdate', function() {
    userinfo.last_logon = new Date().toISOString();
    db.hset('users', userid, userinfo, function(err) {
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
}

function pGet(options, callback) {
  var cb = callback || _.noop,
    opts = options || {},
    userid = opts.userid;

  if (!userid) {
    cb(constants.REQUIRED('userid'));
  } else {
    db.hget('users', userid, function(err, response) {
      if (err) {
        cb(err);
      } else if (!response) {
        cb(constants.dictionary.USER_NOT_FOUND);
      } else {
        cb(null, response);
      }
    });
  }
}

function pLogin(options, callback) {
  var workflow = new EventEmitter(),
    cb = callback || _.noop,
    opts = options || {},
    userid = opts.userid,
    userinfo;

  workflow.on('validateParams', function() {
    validator.check({
      userid: ['string', userid, function(internalCallback) {
        pGet({
          userid
        }, function(err, response) {
          if (err) {
            internalCallback(err);
          } else {
            userinfo = response;
            internalCallback();
          }
        });
      }]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('loginUpdate');
      }
    });
  });

  workflow.on('loginUpdate', function() {
    userinfo.last_logon = new Date().toISOString();
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
}

function pUpdate(options, callback) {
  var workflow = new EventEmitter(),
    cb = callback || _.noop,
    opts = options ? _.clone(options) : {},
    userid = opts.userid,
    userinfo,
    allowedFields = {
      feeds: 'string',
      prevFeeds: 'array',
      token: 'string',
      token_secret: 'string',
      category2: 'string',
      budgetFrom: 'number',
      budgetTo: 'number',
      duration: 'string',
      jobType: 'string',
      workload: 'string',
      notifyInterval: 'number',
      notifyAllow: 'boolean',
      dndFrom: 'string',
      dndTo: 'string',
      useProxy: 'boolean',
      timezone: 'number',
      last_job_date: 'string'
    };

  workflow.on('validateParams', function() {
    var validateFields = {};
    _.each(allowedFields, function(type, name) {
      if (!_.isUndefined(opts[name])) {
        if (_.isDate(opts[name])) {
          opts[name] = opts[name].toISOString();
        }
        validateFields[name] = [type, opts[name]];
      }
    });
    if (!_.size(validateFields)) {
      return cb(constants.dictionary.ACCOUNT_UPDATE_FAILED);
    }

    validator.check(_.extend(validateFields, {
      userid: ['string', userid, function(internalCallback) {
        pGet({
          userid
        }, function(err, response) {
          if (err) {
            internalCallback(err);
          } else {
            userinfo = response;
            internalCallback();
          }
        });
      }]
    }), function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('update');
      }
    });
  });

  workflow.on('update', function() {
    _.each(allowedFields, function(type, name) {
      if (!_.isUndefined(opts[name])) {
        userinfo[name] = opts[name];
      }
    });
    userinfo.updated = new Date().toISOString();
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
}

function pUpdateNotificationsInterval(options, callback) {
  var workflow = new EventEmitter(),
    opts = options || {},
    cb = callback || _.noop,
    userid = opts.userid,
    timezone = opts.timezone,
    prevTimezone = opts.prevTimezone;

  workflow.on('validateParams', function() {
    validator.check({
      userid: ['string', userid, function(internalCallback) {
        pGet({
          userid
        }, internalCallback);
      }],
      timezone: ['number', timezone, function(internalCallback) {
        internalCallback(!_.contains(timeZones, timezone) ? constants.WRONG_TIMEZONE('timezone') : null);
      }],
      prevTimezone: prevTimezone && ['number', prevTimezone, function(internalCallback) {
        internalCallback(!_.contains(timeZones, prevTimezone) ? constants.WRONG_TIMEZONE('prevTimezone') : null);
      }]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('fillMinutes');
      }
    });
  });

  workflow.on('fillMinutes', function() {
    var interval = Number(opts.interval),
      timeReg = /\d{2}:\d{2}/,
      minutesDND = function(dndTime) {
        if (!timeReg.test(dndTime)) {
          return null;
        }
        dndTime = dndTime.split(':');
        return Number(dndTime[0]) * 60 + Number(dndTime[1]);
      },
      dndFrom = minutesDND(opts.dndFrom),
      dndTo = minutesDND(opts.dndTo),
      multiStack = [];

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
          score: 0
        });
      }
    };

    generateStack(baseNotificationInterval, true); // remove previous intervals
    if (interval) {
      generateStack(interval); // add new intervals
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
}

function pDisableNotifications(options, callback) {
  var workflow = new EventEmitter(),
    cb = callback || _.noop,
    opts = options || {},
    userid = opts.userid,
    userinfo;

  workflow.on('validateParams', function() {
    validator.check({
      userid: ['string', userid, function(internalCallback) {
        pGet({
          userid
        }, function(err, response) {
          if (err) {
            internalCallback(err);
          } else {
            userinfo = response;
            internalCallback();
          }
        });
      }]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('disableNotifications');
      }
    });
  });

  workflow.on('disableNotifications', function() {
    // if do not set new interval, method will only remove old interval
    pUpdateNotificationsInterval({
      userid: userid,
      timezone: userinfo.timezone
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('saveUserInfo');
      }
    });
  });

  workflow.on('saveUserInfo', function() {
    userinfo.notifyAllow = false;
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
}

function pStats(options, callback) {
  var workflow = new EventEmitter(),
    cb = callback || _.noop,
    opts = options || {},
    userid = opts.userid,
    userinfo;

  workflow.on('validateParams', function() {
    validator.check({
      userid: ['string', userid, function(internalCallback) {
        pGet({
          userid
        }, function(err, response) {
          if (err) {
            internalCallback(err);
          } else {
            userinfo = response;
            internalCallback();
          }
        });
      }]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
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
}

// ---------
// interface
// ---------

exports = module.exports = {
  create: pCreate,
  get: pGet,
  login: pLogin,
  update: pUpdate,
  updateNotificationsInterval: pUpdateNotificationsInterval,
  disableNotifications: pDisableNotifications,
  stats: pStats
};
