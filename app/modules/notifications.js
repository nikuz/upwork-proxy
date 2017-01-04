'use strict';

var _ = require('underscore'),
  path = require('path'),
  async = require('async'),
  FCM = require('fcm-push'),
  // apn = require('apn'),
  config = require('../../config'),
  log = require('../modules/log'),
  constants = require('../constants')(),
  senderFCM, // Android notifications
  senderAPN; // iOS notifications

if (!senderFCM) {
  senderFCM = new FCM(process.env.FCM_key);
}
// if (!senderAPN) {
//   senderAPN = new apn.Connection({
//     cert: path.join(__dirname, '../../keys/cert.pem'),
//     key: path.join(__dirname, '../../keys/key.pem'),
//     ca: path.join(__dirname, '../../keys/entrust_2048_ca.cer'),
//     production: process.env.NODE_ENV === 'PROD'
//   });
//   senderAPN.on('error', function(err) {
//     log.captureError(err);
//   });
//   senderAPN.on('socketError', function(err) {
//     log.captureError(err);
//   });
// }

// ----------------
// public functions
// ----------------

function pSend(options = {}, callback = _.noop) {
  var notifications = options.notifications || [];

  async.each(notifications, function(item, internalCallback) {
    if (!item.push_id.length || !item.os) {
      return internalCallback();
    }
    var messageText = item.firstJob.title.substring(0, 100);
    if (item.os === 'android') {
      let message = {
        to: item.push_id,
        collapse_key: 'jobs_update',
        // time_to_live: '', // in seconds
        notification: {
          title: config.serviceName,
          body: messageText,
          icon: 'ic_notification',
          sound: 'default'
        },
        data: {
          last_job_date: item.firstJob.date_created
        }
      };
      senderFCM.send(message, function(err) {
        if (err) {
          log.captureError(err);
        }
        internalCallback();
      });
      // let message = new gcm.Message({
      //   data: {
      //     title: config.serviceName,
      //     body: messageText,
      //     icon: 'ic_launcher',
      //     last_job_date: item.firstJob.date_created
      //   }
      // });
      // console.log(item);
      // senderGCM.sendNoRetry(message, item.push_id, internalCallback);
      // senderGCM.sendNoRetry(message, item.push_id, function(err) {
      //   if (err) {
      //     log.captureError(err);
      //   }
      // });
      // internalCallback();
    }
    // else if (item.os === 'ios') {
    //   let myDevice = new apn.Device(item.push_id),
    //     note = new apn.Notification();
    //
    //   _.extend(note, {
    //     alert: messageText,
    //     badge: item.amount,
    //     sound: 'ping.aiff',
    //     payload: {
    //       last_job_date: item.firstJob.date_created
    //     }
    //   });
    //
    //   senderAPN.pushNotification(note, myDevice);
    //   internalCallback();
    // }
  }, callback);
}


// ---------
// interface
// ---------

exports = module.exports = {
  send: pSend
};
