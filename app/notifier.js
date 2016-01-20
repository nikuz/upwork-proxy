'use strict';

var _ = require('underscore'),
  async = require('async'),
  db = require('./db'),
  config = require('./../config'),
  upwork = require('./modules/upwork'),
  account = require('./models/account'),
  log = require('./modules/log'),
  notificationsModule = require('./modules/notifications'),
  timeZones = require('../data/timezones'),
  interval = 6e4 * config.notification_interval; // 5 minutes

function filterJobs(options) {
  var opts = options || {},
    jobs = opts.jobs,
    limiter = opts.limiter,
    filteredJobs = [];

  if (!_.isDate(limiter)) {
    limiter = new Date(limiter);
  }

  _.each(jobs, function(job) {
    if (new Date(job.date_created) > limiter) {
      filteredJobs.push(job);
    }
  });
  return filteredJobs;
}

// calculate current minutes in all time zones
function calculateMinutes(options, callback) {
  var opts = options || {},
    cb = callback || _.noop,
    today = opts.minute ? new Date(opts.minute) : new Date(),
    curUTCMinute = today.getUTCHours() * 60 + today.getUTCMinutes(),
    minutesPerDay = 1440, // minutes per day
    minutes = [];

  _.each(timeZones, function(zone) {
    var zoneMinute = curUTCMinute - Number(zone);
    if (zoneMinute < 0) {
      zoneMinute = minutesPerDay - Math.abs(zoneMinute);
    } else if (zoneMinute > minutesPerDay) {
      zoneMinute = zoneMinute - minutesPerDay;
    } else if (zoneMinute === minutesPerDay) {
      zoneMinute = 0;
    }
    minutes.push(`time:${zone}:${zoneMinute}`);
  });

  cb(null, {
    curMinute: curUTCMinute,
    minutes: minutes
  });
}

function process(options) {
  var opts = options || {},
    startTime = Date.now(),
    minutes,
    users,
    notifications = [];

  log.captureMessage('Start job at ' + new Date());
  async.series([
    function(callback) {
      //new Date(Date.now() + opts.timeToStartCron).getUTCMinutes()
      calculateMinutes(null, function(err, response) {
        if (err) {
          callback(err);
        } else {
          log.captureMessage('Cur UTC minute: ' + response.curMinute);
          minutes = response.minutes;
          callback();
        }
      });
    },
    function(callback) {
      // get users who should get notification on current minutes
      db.union(minutes, 'users', function(err, response) {
        if (err) {
          callback(err);
        } else {
          users = response.items;
          callback();
        }
      });
    },
    function(callback) {
      // check users activity, get new jobs, calculate notifications count
      log.captureMessage('Users to delivery: %d', users.length);
      if (!users.length) {
        return callback();
      }

      async.each(users, function(user, internalCallback) {
        if (new Date() - new Date(user.last_logon) > 864e5 * 2) {
          // if user doesn't use APP more than two days disable notifications for him
          return account.disableNotifications({
            userid: user.id
          }, internalCallback);
        }

        var reqFieldPrepare = function(field) {
            field = field.toLowerCase().replace(' ', '_');
            return field === 'all' ? '' : field;
          },
          requestData = {
            q: user.feeds,
            budget: `[${user.budgetFrom} TO ${user.budgetTo}]`,
            duration: reqFieldPrepare(user.duration),
            job_type: reqFieldPrepare(user.jobType),
            workload: reqFieldPrepare(user.workload),
            paging: '0;50',
            sort: 'create_time desc'
          };

        if (user.category2) {
          requestData.category2 = user.category2;
        }
        upwork.request({
          url: config.API_jobs_url,
          data: requestData,
          cacheIdData: requestData
        }, function(err, response) {
          if (err) {
            return internalCallback();
          }

          response = filterJobs({
            jobs: response.jobs,
            limiter: user.last_job_date
          });
          if (response.length) {
            notifications.push({
              userid: user.id,
              push_id: user.push_id,
              os: user.os,
              amount: response.length,
              firstJob: response[0]
            });
          }
          internalCallback();
        });
      }, callback);
    },
    function(callback) {
      // send notifications
      log.captureMessage('Notifications to delivery: %d', notifications.length);
      if (!notifications.length) {
        return callback();
      }

      notificationsModule.send({
        notifications: notifications
      }, callback);
    }
  ], function(err) {
    if (err) {
      log.captureError(err);
    } else {
      let endTime = new Date().getTime(),
        spentTime = (endTime - startTime) / 1000;

      log.captureMessage('Done. Spent time: ' + spentTime);
    }
  });
}

// ----------------
// public functions
// ----------------

function pStart(options, callback) {
  var opts = options || {},
    cb = callback || _.noop,
    today = opts.minute ? new Date(opts.minute) : new Date(),
    i = today.getUTCHours() * 60 + today.getUTCMinutes(),
    l = 1440, // minutes per day
    s = today.getUTCSeconds(),
    timeToStartCron = 0;

  for (; i <= l; i += 1) {
    if (i % 5 === 0) {
      break;
    }
    timeToStartCron += 1;
  }
  timeToStartCron = 6e4 * (timeToStartCron || 5) - s * 1000;
  if (opts.test) {
    cb(null, {
      startAfter: timeToStartCron
    });
  } else {
    console.log('Seconds to first notification: %d', timeToStartCron / 1000);
    setTimeout(function() {
      log.captureMessage('Start cron job in %s', new Date());
      process();
      setInterval(process, interval);
    }, timeToStartCron);
  }
}

function pCalculateMinutes(options, callback) {
  calculateMinutes(options, callback);
}

function pFilterJobs(options) {
  return filterJobs(options);
}

// ---------
// interface
// ---------

exports = module.exports = {
  start: pStart,
  filterJobs: pFilterJobs,
  calculateMinutes: pCalculateMinutes
};
