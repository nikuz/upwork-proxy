'use strict';

var _ = require('underscore'),
  path = require('path'),
  async = require('async'),
  gcm = require('node-gcm'),
  apn = require('apn'),
  config = require('../../config'),
  log = require('../modules/log'),
  constants = require('../constants')(),
  senderGCM, // Android notifications
  senderAPN; // iOS notifications

if (!senderGCM) {
  senderGCM = new gcm.Sender(process.env.GCM_key);
}
if (!senderAPN) {
  senderAPN = new apn.Connection({
    cert: path.join(__dirname, '../../keys/cert.pem'),
    key: path.join(__dirname, '../../keys/key.pem'),
    ca: path.join(__dirname, '../../keys/entrust_2048_ca.cer'),
    production: process.env.NODE_ENV === 'PROD'
  });
  senderAPN.on('error', function(err) {
    log.captureError(err);
  });
  senderAPN.on('socketError', function(err) {
    log.captureError(err);
  });
}

// ----------------
// public functions
// ----------------

function pSend(options, callback) {
  var cb = callback || function() {},
    opts = options || {},
    notifications = opts.notifications || [];

  async.each(notifications, function(item, internalCallback) {
    if (!item.push_id.length || !item.os) {
      return internalCallback();
    }
    var messageText = item.firstJob.title.substring(0, 100);
    if (item.os === 'android') {
      let message = new gcm.Message();
      message.addData({
        title: config.serviceName,
        message: messageText,
        last_job_date: item.firstJob.date_created
      });
      senderGCM.sendNoRetry(message, [item.push_id], function(err) {
        if (err) {
          log.captureError(err);
        }
      });
      internalCallback();
    } else if (item.os === 'ios') {
      let myDevice = new apn.Device(item.push_id),
        note = new apn.Notification();

      _.extend(note, {
        alert: messageText,
        badge: item.amount,
        sound: 'ping.aiff',
        payload: {
          last_job_date: item.firstJob.date_created
        }
      });

      senderAPN.pushNotification(note, myDevice);
      internalCallback();
    }
  }, cb);
}


// ---------
// interface
// ---------

exports = module.exports = {
  send: pSend
};
