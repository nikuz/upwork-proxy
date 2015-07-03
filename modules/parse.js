'use strict';

var db = require('../components/db'),
  async = require('async'),
  Parse = require('parse').Parse,
  config = require('../config.json');

Parse.initialize(
  config.PARSE_ID,
  config.PARSE_KEY,
  config.PARSE_MASTER_KEY
);

var noop = function() {};

var saveNotification = function(options, callback) {
  var opts = options || {},
    userid = opts.userid,
    message = opts.message,
    last_job_date = opts.last_job_date,
    notificationId,
    userInfo,
    date = new Date();

  async.series([
    function(internalCallback) {
      // get user info
      db.hget('users', userid, function(err, response) {
        if (err || !response) {
          internalCallback('Failed to get user info');
        } else {
          userInfo = response;
          internalCallback();
        }
      });
    },
    function(internalCallback) {
      // get id for new notification
      db.counter('g_notifications', function(err, response) {
        if (err || !response) {
          internalCallback('Failed to get new notification ID');
        } else {
          notificationId = response.toString();
          internalCallback();
        }
      });
    },
    function(internalCallback) {
      // save notification model
      var notificationInfo = {
        userid: userid,
        message: message,
        unread: true,
        created: date.toISOString()
      };
      db.hset('notifications', notificationId, notificationInfo, function(err, response) {
        internalCallback(err || !response ? 'Can\'t save notification'  : null);
      });
    },
    function(internalCallback) {
      // bind notification to user
      db.zadd('user:' + userid + ':notifications:unread', notificationId, date.getTime(), internalCallback);
    },
    function(internalCallback) {
      // save last_job_date to user info
      userInfo.last_job_date = last_job_date;
      db.hset('users', userid, userInfo, internalCallback);
    }
  ], function(err) {
    callback(err);
  });
};


// ----------------
// public functions
// ----------------

var pSend = function(options, callback) {
  var cb = callback || noop,
    opts = options || {},
    notifications = opts.notifications;

  async.each(notifications, function(item, internalCallback) {
    var query = new Parse.Query(Parse.Installation);
    query.equalTo('channels', {
      $in: ['user-' + item.userid]
    });
    Parse.Push.send({
      where: query,
      data: {
        alert: item.message
      }
    }, {
      success: function() {
        saveNotification(item, function(err) {
          if (err) {
            console.log(err);
          }
          internalCallback();
        });
      },
      error: function(err) {
        console.log(err);
        internalCallback();
      }
    });
  }, function(err) {
    cb(err);
  });
};


// ---------
// interface
// ---------

exports = module.exports = {
  send: pSend
};

