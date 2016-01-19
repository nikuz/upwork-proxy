'use strict';

var async = require('async'),
  gcm = require('node-gcm'),
  apn = require('apn'),
  config = require('../../config'),
  log = require('../modules/log'),
  senderGCM = new gcm.Sender(process.env.GCM_key),
  senderAPN = new apn.Connection({
    cert: '/var/www/upwork-proxy/keys/deploy-cert.pem',
    key: '/var/www/upwork-proxy/keys/deploy-key.pem',
    ca: '/var/www/upwork-proxy/keys/entrust_2048_ca.cer',
    production: true
  }),
  constants = require('../constants')();

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

// ----------------
// public functions
// ----------------

var pSend = function(options, callback) {
  var cb = callback || function() {},
    opts = options || {},
    notifications = opts.notifications || [];

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

