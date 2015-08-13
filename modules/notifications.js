'use strict';

var db = require('../components/db'),
  async = require('async'),
  gcm = require('node-gcm'),
  apn = require('apn'),
  config = require('../config.json'),
  log = require('./log')(),
  senderGCM = new gcm.Sender(config.GCM_key),
  senderAPN = new apn.Connection({
    cert: '/var/www/upwork-proxy/keys/deploy-cert.pem',
    key: '/var/www/upwork-proxy/keys/deploy-key.pem',
    ca: '/var/www/upwork-proxy/keys/entrust_2048_ca.cer',
    production: true
  }),
  constants = require('../components/constants');

senderAPN.on('error', function(err) {
  log.captureMessage(constants.get('APN_ERROR'), {
    extra: {
      err: err
    }
  });
});
senderAPN.on('socketError', function(err) {
  log.captureMessage(constants.get('APN_SOCKET_ERROR'), {
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
    last_job_date = opts.firstJob.date_created,
    notificationId,
    userInfo,
    date = new Date();

  async.series([
    function(internalCallback) {
      // get user info
      db.hget('users', userid, function(err, response) {
        if (err) {
          internalCallback(constants.get('DATABASE_ERROR'));
        } else if (!response) {
          internalCallback(constants.get('USER_NOT_FOUND'));
        } else {
          userInfo = response;
          internalCallback();
        }
      });
    },
    function(internalCallback) {
      // get id for new notification
      db.counter('g_notifications', function(err, response) {
        if (err) {
          internalCallback(constants.get('DATABASE_ERROR'));
        } else if (!response) {
          internalCallback(constants.get('FAILED_GET_NOTIFICATION_ID'));
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
        internalCallback(err || !response ? constants.get('FAILED_SAVE_NOTIFICATION')  : null);
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
    var messageText = item.firstJob.title.substring(0, 100);
    if (item.os === 'android' && item.push_id.length > 0) {
      var message = new gcm.Message();
      message.addData({
        title: config.serviceName,
        message: messageText,
        last_job_date: item.firstJob.date_created
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
    } else if (item.os === 'ios' && item.push_id.length > 0) {
      var myDevice = new apn.Device(item.push_id),
        note = new apn.Notification();

      note.alert = messageText;
      note.badge = item.amount;
      note.sound = 'ping.aiff';
      note.payload = {
        last_job_date: item.firstJob.date_created
      };

      senderAPN.pushNotification(note, myDevice);
      saveNotification(item);
      internalCallback();
    } else {
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

