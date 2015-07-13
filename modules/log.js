'use strict';

var raven = require('raven'),
  config = require('../config.json'),
  client;

exports = module.exports = function() {
  if (!client) {
    client = new raven.Client(config.SENTRY_URL);
  }
  return client;
};