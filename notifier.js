'use strict';

var _ = require('underscore'),
  async = require('async'),
  db = require('./components/db'),
  config = require('./config.json'),
  upwork = require('./modules/upwork'),
  log = require('./modules/log')(),
  notifications = require('./modules/notifications'),
  interval = 6e4, // one minute
  sessionJob = 0;

var filterJobs = function(options) {
  var opts = options || {},
    jobs = opts.jobs,
    user = opts.user,
    min_date = new Date(user.last_job_date),
    durationReg = new RegExp(user.duration, 'i'),
    jobTypeReg = new RegExp(user.jobType, 'i'),
    workloadFullTimeReg = '30+ hrs/week';

  var filteredJobs = [];
  _.each(jobs, function(job) {
    var suited = true;
    if (new Date(job.date_created) <= min_date) {
      suited = false;
    } else if ((job.budget < user.budgetFrom || job.budget > user.budgetTo) && !_.isNull(job.budget)) {
      suited = false;
    } else if (user.duration !== 'All' && !_.isNull(job.duration) && !durationReg.test(job.duration)) {
      suited = false;
    } else if (user.jobType !== 'All' && !_.isNull(job.jobType) && !jobTypeReg.test(job.job_type)) {
      suited = false;
    } else if (user.workload !== 'All' && !_.isNull(job.workload) && user.workload === 'Full time' && job.workload !== workloadFullTimeReg) {
      suited = false;
    }
    if (suited) {
      filteredJobs.push(job);
    }
  });
  return filteredJobs;
};

var process = function() {
  console.log('Start job ' + (sessionJob += 1) + ' at ' + new Date());
  var startTime = new Date().getTime();
  async.waterfall([
    function(callback) {
      // calculate current minute
      var now = new Date(),
        year = now.getFullYear(),
        month = now.getMonth(),
        day = now.getDate(),
        today = new Date(year, month, day);

      callback(null, parseInt((now.getTime() - today.getTime()) / 1000 / 60, 10));
    },
    function(curMinute, callback) {
      // get users that should get notification on current minute
      console.log('Cur minute: ' + curMinute);
      db.intersection(['time:' + curMinute], 'users', {per_page: 0}, function(err, response) {
        if (err) {
          callback(err);
        } else {
          callback(null, response.items);
        }
      });
    },
    function(users, callback) {
      // group users by feeds
      if (users.length) {
        var feeds = {};
        _.each(users, function(user) {
          if (!feeds[user.feeds]) {
            feeds[user.feeds] = [];
          }
          feeds[user.feeds].push(user);
        });
        users = null;
        callback(null, feeds);
      } else {
        console.log('No users');
        callback(null, null);
      }
    },
    function(feeds, callback) {
      if (feeds) {
        // get new jobs
        var notifications = [];
        async.each(feeds, function(users, internalCallback) {
          var feed = users[0].feeds;
          upwork.request({
            url: config.API_jobs_url,
            dataType: 'json',
            data: {
              q: feed,
              paging: '0;50'
            }
          }, function(err, response) {
            if (err) {
              internalCallback(err);
            } else {
              response = JSON.parse(response);
              _.each(users, function(user) {
                var jobs = filterJobs({
                  jobs: response.jobs,
                  user: user
                });
                if (jobs.length) {
                  jobs = _.sortBy(jobs, function(item) {
                    return -new Date(item.date_created).getTime();
                  });
                  notifications.push({
                    userid: user.id,
                    push_id: user.push_id,
                    os: user.os,
                    amount: jobs.length,
                    message: 'You have new ' + jobs.length + ' vacancies',
                    last_job_date: jobs[0].date_created
                  });
                }
              });
              internalCallback();
            }
          });
        }, function(err) {
          if (err) {
            callback(err);
          } else {
            callback(null, notifications);
          }
        });
      } else {
        callback(null, null);
      }
    },
    function(messages, callback) {
      if (messages) {
        // send notifications
        notifications.send(messages, callback);
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

var pStart = function() {
  setInterval(process, interval);
  process();
};

// ---------
// interface
// ---------

exports = module.exports = {
  start: pStart
};
