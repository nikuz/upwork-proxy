'use strict';

var winston = require('winston'),
  config = require('../../config'),
  ready;

require('winston-loggly');

if (!ready) {
  ready = true;
  winston.add(winston.transports.Loggly, {
    token: process.env.LOGGLY_token,
    subdomain: process.env.LOGGLY_subdomain,
    tags: ['upwatcher-proxy'],
    json: true
  });
}

// ----------------
// public functions
// ----------------

function pCaptureMessage(message) {
  if (process.env.NODE_ENV === 'PROD') {
    console.log(message);
    winston.log(message);
  }
}

function pCaptureError(message) {
  if (process.env.NODE_ENV === 'PROD') {
    console.error(message);
    winston.error(message);
  }
}

// ---------
// interface
// ---------

exports = module.exports = {
  captureMessage: pCaptureMessage,
  captureError: pCaptureError
};
