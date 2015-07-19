'use strict';

var db = require('../components/db'),
  async = require('async'),
  gcm = require('node-gcm'),
  apn = require('apn'),
  config = require('../config.json'),
  log = require('./log')(),
  senderGCM = new gcm.Sender(config.GCM_key),
  senderAPN = new apn.Connection({
    cert: '/var/www/upwork-proxy/keys/cert.pem',
    key: '/var/www/upwork-proxy/keys/key.pem',
    ca: '/var/www/upwork-proxy/keys/entrust_2048_ca.cer',
    production: false
  });

senderAPN.on('error', function(err) {
  log.captureMessage('APN error', {
    extra: {
      err: err
    }
  });
});
senderAPN.on('socketError', function(err) {
  log.captureMessage('APN socket error', {
    extra: {
      err: err
    }
  });
});


var noop = function() {};

var saveNotification = function(options) {
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
    if (err) {
      log.captureMessage('Save notification data error', {
        extra: {
          err: err
        }
      });
    }
  });
};


// ----------------
// public functions
// ----------------

var pSend = function(notifications, callback) {
  var cb = callback || noop;
  notifications = notifications || [];
  async.each(notifications, function(item, internalCallback) {
    if (item.os === 'android') {
      var message = new gcm.Message();
      message.addData({
        title: config.serviceName,
        message: item.message,
        last_job_date: item.last_job_date
      });
      senderGCM.sendNoRetry(message, [item.push_id], function(err) {
        if (err) {
          log.captureMessage('GCM error', {
            extra: {
              err: err
            }
          });
        } else {
          saveNotification(item);
        }
      });
      internalCallback();
    } else if (item.os === 'ios') {
      var myDevice = new apn.Device(item.push_id),
        note = new apn.Notification();

      note.alert = item.message;
      note.badge = item.amount;
      note.sound = 'ping.aiff';
      note.payload = {
        last_job_date: item.last_job_date
      };

      senderAPN.pushNotification(note, myDevice);
      saveNotification(item);
      internalCallback();
    }
  }, cb);
};


// ---------
// interface
// ---------

exports = module.exports = {
  send: pSend
};

