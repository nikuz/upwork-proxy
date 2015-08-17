'use strict';

var raven = require('raven'),
  config = require('../../config.json'),
  client;

if (!client) {
  client = new raven.Client(config.SENTRY_URL);
}

// ----------------
// public functions
// ----------------

var pCaptureMessage = function(name, opts) {
  if (process.env.CURRENT_ENV === 'TEST') {
    client.captureMessage(name, opts);
  }
};

// ---------
// interface
// ---------

exports = module.exports = {
  captureMessage: pCaptureMessage
};
