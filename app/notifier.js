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
  interval = 6e4 * 5; // 5 minutes;

var filterJobs = function(options, callback) {
  var opts = options || {},
    cb = callback || _.noop,
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
  cb(null, filteredJobs);
};

// calculate current minutes in all time zones
var calculateMinutes = function(options, callback) {
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
    minutes.push('time:' + zone + ':' + zoneMinute);
  });

  cb(null, {
    curMinute: curUTCMinute,
    minutes: minutes
  });
};

var reqFieldPrepare = function(field) {
  field = field.toLowerCase().replace(' ', '_');
  return field === 'all' ? '' : field;
};

var process = function(options) {
  var opts = options || {},
    startTime = Date.now(),
    minutes,
    users,
    notifications = [];

  console.log('Start job at ' + new Date());
  async.series([
    function(callback) {
      //new Date(Date.now() + opts.timeToStartCron).getUTCMinutes()
      calculateMinutes(null, function(err, response) {
        if (err) {
          callback(err);
        } else {
          console.log('Cur UTC minute: ' + response.curMinute);
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
      // parse users, get new jobs, calculate notifications count
      console.log('Users to delivery: %d', users.length);
      if (users.length) {
        async.each(users, function(user, internalCallback) {
          // if user doesn't use APP more than two days
          if (Date.now() - new Date(user.updated).getTime() > 864e5 * 2) {
            // remove user from notifications queue
            account.disableNotifications({
              userid: user.id
            });
            internalCallback();
          } else {
            var requestData = {
              q: user.feeds,
              budget: '[' + user.budgetFrom + ' TO ' + user.budgetTo + ']',
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
              data: requestData
            }, function(err, response) {
              if (err) {
                internalCallback();
              } else {
                try {
                  response = JSON.parse(response);
                } catch (e) {
                  console.log('Upwork response is not JSON: ' + response);
                  return internalCallback();
                }
                filterJobs({
                  jobs: response.jobs,
                  limiter: user.last_job_date
                }, function(err, response) {
                  if (response.length) {
                    notifications.push({
                      userid: user.id,
                      push_id: user.push_id,
                      os: user.os,
                      amount: response.length,
                      firstJob: response[0]
                    });
                  }
                });
                internalCallback();
              }
            });
          }
        }, callback);
      } else {
        callback();
      }
    },
    function(callback) {
      // send notifications
      console.log('Notifications to delivery: %d', notifications.length);
      if (notifications.length) {
        notificationsModule.send({
          notifications: notifications
        }, callback);
      } else {
        callback();
      }
    }
  ], function(err) {
    var endTime = new Date().getTime(),
      spentTime = (endTime - startTime) / 1000;

    if (err) {
      console.log(err);
      log.captureMessage('Upwork proxy cron job error', {
        extra: {
          err: err
        }
      });
    } else {
      console.log('Spent time: ' + spentTime);
      console.log('Done!');
      if (spentTime > 60) {
        log.captureMessage('Upwork proxy cron job time', {
          extra: {
            time: 'Spent time: ' + spentTime
          }
        });
      }
    }
  });
};

// ----------------
// public functions
// ----------------

var pStart = function(options, callback) {
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
      console.log('Start cron job in %s', new Date());
      process();
      setInterval(process, interval);
    }, timeToStartCron);
  }
};

var pCalculateMinutes = function(options, callback) {
  calculateMinutes(options, callback);
};

var pFilterJobs = function(options, callback) {
  filterJobs(options, callback);
};

// ---------
// interface
// ---------

exports = module.exports = {
  start: pStart,
  filterJobs: pFilterJobs,
  calculateMinutes: pCalculateMinutes
};
