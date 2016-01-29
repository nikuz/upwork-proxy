'use strict';

var notificationsModule = require('../app/modules/notifications'),
  validator = require('../app/modules/validator'),
  EventEmitter = require('events').EventEmitter;

exports = module.exports = function(options, callback) {
  var workflow = new EventEmitter(),
    opts = options || {},
    cb = callback,
    push_id = opts.id,
    os = opts.os;

  workflow.on('validateParams', function() {
    validator.check({
      id: ['string', push_id],
      os: ['string', os]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('send');
      }
    });
  });

  workflow.on('send', function() {
    notificationsModule.send({
      notifications: [{
        push_id: push_id,
        os: os,
        amount: 1,
        firstJob: {
          title: 'Some test notification'
        }
      }]
    }, function(err, response) {
      console.log(err);
      console.log(response);
    });
  });

  workflow.emit('validateParams');
};
