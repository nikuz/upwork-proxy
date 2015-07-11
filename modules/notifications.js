'use strict';

var db = require('../components/db'),
  async = require('async'),
  gcm = require('node-gcm'),
  config = require('../config.json'),
  sender = new gcm.Sender(config.GCM_key);

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

var pSend = function(notifications, callback) {
  var cb = callback || noop;
  notifications = notifications || [];

  async.each(notifications, function(item, internalCallback) {
    var message = new gcm.Message();
    message.addData({
      title: 'Watch Upwork',
      message: item.message
    });
    sender.sendNoRetry(message, [item.userid], function(err) {
      if (err) {
        console.log('sendNoRetry err: ' + err);
        // no need to interrupt the notification sending process to other users
        internalCallback();
      } else {
        saveNotification(item, function(err) {
          if (err) {
            console.log('saveNotification err: ' + err);
          }
          internalCallback();
        });
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

