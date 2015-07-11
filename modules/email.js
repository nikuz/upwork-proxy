'use strict';

var nodemailer = require('nodemailer'),
  config = require('../config'),
  transporter;

var noop = function() {};

exports = module.exports = function() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: config.admin_email,
        pass: config.admin_email_pass
      }
    });
  }

  return {
    send: function(to, subject, text, callback) {
      if (typeof text !== 'string') {
        text = text.toString();
      }
      var cb = callback || noop;
      transporter.sendMail({
        from: config.serviceName + ' <' + config.admin_email + '>',
        to: to,
        subject: subject,
        text: text
      }, cb);
    }
  };
};
