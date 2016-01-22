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
  console.log(message);
  if (process.env.NODE_ENV === 'PROD') {
    winston.log(message);
  }
}

function pCaptureError(message) {
  console.error(message);
  if (process.env.NODE_ENV === 'PROD') {
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
