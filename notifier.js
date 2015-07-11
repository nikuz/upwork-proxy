'use strict';

var startTime = new Date().getTime(),
  _ = require('underscore'),
  async = require('async'),
  db = require('./components/db'),
  config = require('./config.json'),
  upwork = require('./modules/upwork'),
  email = require('./modules/email')(),
  notifications = require('./modules/notifications');

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
      callback(true);
    }
  },
  function(feeds, callback) {
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
  },
  function(messages, callback) {
    // send notifications
    notifications.send(messages, callback);
  }
], function(err) {
  var endTime = new Date().getTime(),
    spentTime = (endTime - startTime) / 1000;

  if (err) {
    console.log('Notifier error: ' + err);
    email.send(config.admin_email, 'Upwork proxy cron job error', err, function() {
      process.exit(1);
    });
  } else {
    console.log('Done!');
    if (spentTime > 60) {
      email.send(config.admin_email, 'Upwork proxy cron job time', 'Spent time: ' + spentTime, function() {
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  }
});
