'use strict';

var _ = require('underscore'),
  async = require('async'),
  db = require('./components/db'),
  config = require('./config.json'),
  upwork = require('./modules/upwork'),
  account = require('./modules/account'),
  log = require('./modules/log')(),
  notificationsModule = require('./modules/notifications'),
  timeZones = require('./data/timezones'),
  interval = 6e4 * 5, // 5 minutes
  sessionJob = 0;

var noop = function() {};

var filterJobs = function(options, callback) {
  var opts = options || {},
    cb = callback || noop,
    jobs = opts.jobs,
    user = opts.user,
    filteredJobs = [];

  _.each(jobs, function(job) {
    if (job.date_created > user.last_job_date) {
      filteredJobs.push(job);
    }
  });
  cb(null, filteredJobs);
};

//var filterJobs = function(options, callback) {
//  var opts = options || {},
//    cb = callback || noop,
//    jobs = opts.jobs,
//    user = opts.user,
//    durations = {
//      Month: 'Less than 1 month',
//      Week: 'Less than 1 week',
//      Quarter: '1 to 3 months',
//      Semester: '3 to 6 months',
//      Ongoing: 'More than 6 months'
//    },
//    workloads = {
//      'As needed': [
//        '30+ hrs/week',
//        'Less than 10 hrs/week'
//      ],
//      'Part time': [
//        '30+ hrs/week',
//        '10-30 hrs/week'
//      ],
//      'Full time': [
//        '30+ hrs/week'
//      ]
//    },
//    filteredJobs = [];
//
//  _.each(jobs, function(job) {
//    var suited = true;
//    if (job.date_created <= user.last_job_date) {
//      suited = false;
//    } else if (!_.isNull(job.budget) && (job.budget < Number(user.budgetFrom) || job.budget > Number(user.budgetTo))) {
//      suited = false;
//    } else if (user.duration !== 'All' && !_.isNull(job.duration) && job.duration !== durations[user.duration]) {
//      suited = false;
//    } else if (user.jobType !== 'All' && !_.isNull(job.job_type) && job.job_type !== user.jobType) {
//      suited = false;
//    } else if (user.workload !== 'All' && !_.isNull(job.workload) && !_.contains(workloads[user.workload], job.workload)) {
//      suited = false;
//    }
//    if (suited) {
//      filteredJobs.push(job);
//    }
//  });
//  cb(null, filteredJobs);
//};

// calculate current minutes in all time zones
var calculateMinutes = function(options, callback) {
  var opts = options || {},
    cb = callback || noop,
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

var process = function() {
  console.log('Start job ' + (sessionJob += 1) + ' at ' + new Date());
  var startTime = new Date().getTime();
  async.waterfall([
    function(callback) {
      calculateMinutes(null, function(err, response) {
        if (err) {
          callback(err);
        } else {
          console.log('Cur UTC minute: ' + response.curMinute);
          callback(null, response.minutes);
        }
      });
    },
    function(curMinutes, callback) {
      // get users who should get notification on current minutes
      db.union(curMinutes, 'users', function(err, response) {
        if (err) {
          callback(err);
        } else {
          callback(null, response.items);
        }
      });
    },
    //function(users, callback) {
    //  // group users by feeds
    //  if (users.length) {
    //    console.log('Users to delivery: %d', users.length);
    //    var feeds = {};
    //    _.each(users, function(user) {
    //      if (!feeds[user.feeds]) {
    //        feeds[user.feeds] = [];
    //      }
    //      feeds[user.feeds].push(user);
    //    });
    //    users = null;
    //    callback(null, feeds);
    //  } else {
    //    console.log('No users');
    //    callback(null, null);
    //  }
    //},
    function(users, callback) {
      if (users.length) {
        console.log('Users to delivery: %d', users.length);
        // get new jobs
        var notifications = [];
        async.each(users, function(user, internalCallback) {
          // if user doesn't use APP more than two days
          if (Date.now() - new Date(user.updated).getTime() > 864e5 * 2) {
            // remove user from notifications queue
            account.disableNotifications({
              userid: user.id
            });
            internalCallback();
          } else {
            upwork.request({
              url: config.API_jobs_url,
              data: {
                q: user.feed,
                category2: user.category2,
                budget: '[' + user.budgetFrom + ' TO ' + user.budgetTo + ']',
                duration: reqFieldPrepare(user.duration),
                job_type: reqFieldPrepare(user.jobType),
                workload: reqFieldPrepare(user.workload),
                paging: '0;50',
                sort: 'create_time desc'
              }
            }, function(err, response) {
              if (err) {
                internalCallback(err);
              } else {
                try {
                  response = JSON.parse(response);
                } catch (e) {
                  return internalCallback('Upwork response is not JSON: ' + response);
                }
                filterJobs({
                  jobs: response.jobs,
                  user: user
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
        }, function(err) {
          if (err) {
            callback(err);
          } else {
            callback(null, notifications);
          }
        });
      } else {
        console.log('No users');
        callback(null, null);
      }
    },
    function(notifications, callback) {
      if (notifications && notifications.length) {
        // send notifications
        console.log('Notifications to delivery: %d', notifications.length);
        notificationsModule.send(notifications, callback);
      } else {
        callback(null, null);
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
    cb = callback || noop,
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
  console.log('Secconds to first notification: %d', timeToStartCron / 1000);
  if (opts.test) {
    cb(null, {
      startAfter: timeToStartCron
    });
  } else {
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

// ---------
// interface
// ---------

exports = module.exports = {
  start: pStart,
  calculateMinutes: pCalculateMinutes
};
