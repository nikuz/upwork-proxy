'use strict';

var raven = require('raven'),
  config = require('../../config'),
  client;

if (!client) {
  client = new raven.Client(config.SENTRY_URL);
}

// ----------------
// public functions
// ----------------

var pCaptureMessage = function(name, opts) {
  if (process.env.NODE_ENV === 'PROD') {
    client.captureMessage(name, opts);
  }
};

// ---------
// interface
// ---------

exports = module.exports = {
  captureMessage: pCaptureMessage
};
