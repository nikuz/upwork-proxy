'use strict';

var config = require('../../config.json'),
  _ = require('underscore'),
  OAuth = require('../components/oauth'),
  https = require('https'),
  constants = require('../components/constants'),
  log = require('./log'),
  oauth;

if (!oauth) {
  oauth = OAuth.init({
    consumer: {
      public: config.API_key,
      secret: config.API_secret
    }
  });
}

// ----------------
// public methods
// ----------------

var pRequest = function(options, callback) {
  var opts = options,
    cb = callback,
    url = opts.url,
    method = opts.method || 'GET';

  var token = config.API_token,
    request_data = {
      url: config.API_url + url,
      method: method,
      data: _.extend(opts.data || {}, token && {oauth_token: token})
    },
    urlDelimiter;

  request_data = oauth.authorize(request_data, {
    secret: config.API_token_secret
  });

  url = config.API_url + url;
  _.each(request_data, function(item, key) {
    if (!urlDelimiter) {
      urlDelimiter = /\?/.test(url) ? '&' : '?';
    } else {
      urlDelimiter = '&';
    }
    url += urlDelimiter + key + '=' + encodeURIComponent(item);
  });

  https.get(url, function(res) {
    res.setEncoding('utf8');
    var data = '';
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on('end', function() {
      cb(null, data);
    });
  }).on('error', function(e) {
    log.captureMessage(constants.get('UPWORK_REQUEST_ERROR'), {
      extra: {
        err: e.message
      }
    });
    cb(e.message);
  });
};

// ---------
// interface
// ---------

exports = module.exports = {
  request: pRequest
};
