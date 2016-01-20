'use strict';

var path = require('path'),
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
    cert: path.join(__dirname, '../../keys/deploy-cert.pem'),
    key: path.join(__dirname, '../../keys/deploy-key.pem'),
    ca: path.join(__dirname, '../../keys/entrust_2048_ca.cer'),
    production: process.env.NODE_ENV === 'PROD'
  });
  senderAPN.on('error', function(err) {
    log.captureMessage(constants.dictionary.APN_ERROR, {
      extra: {
        err: err
      }
    });
  });
  senderAPN.on('socketError', function(err) {
    log.captureMessage(constants.dictionary.APN_SOCKET_ERROR, {
      extra: {
        err: err
      }
    });
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
          log.captureMessage('GCM error', {
            extra: {
              err: err
            }
          });
        }
      });
      internalCallback();
    } else if (item.os === 'ios') {
      let myDevice = new apn.Device(item.push_id),
        note = new apn.Notification();

      note.alert = messageText;
      note.badge = item.amount;
      note.sound = 'ping.aiff';
      note.payload = {
        last_job_date: item.firstJob.date_created
      };

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
