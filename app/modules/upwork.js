'use strict';

var config = require('../../config'),
  _ = require('underscore'),
  OAuth = require('./oauth'),
  https = require('https'),
  constants = require('../constants')(),
  log = require('../modules/log'),
  validator = require('../modules/validator'),
  cache = require('../models/cache'),
  EventEmitter = require('events').EventEmitter,
  oauth;

if (!oauth) {
  oauth = OAuth.init({
    consumer: {
      public: process.env.API_key,
      secret: process.env.API_secret
    }
  });
}

// ----------------
// public methods
// ----------------

function pRequest(options, callback) {
  var workflow = new EventEmitter(),
    opts = options,
    cb = callback,
    url = opts.url,
    token = opts.token || process.env.API_token,
    token_secret = opts.token_secret || process.env.API_token_secret,
    method = opts.method || 'GET',
    cacheIdData = opts.cacheIdData,
    cacheTTL = opts.cacheTTL,
    cacheId;

  workflow.on('validateParams', function() {
    validator.check({
      url: ['string', url],
      token: ['string', token],
      token_secret: ['string', token_secret],
      method: ['string', method],
      cacheIdData: ['object', cacheIdData]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('checkCache');
      }
    });
  });

  workflow.on('checkCache', function() {
    cacheId = cache.getId(cacheIdData);
    cache.get({
      id: cacheId
    }, function(err, response) {
      if (err) {
        cb(err);
      } else if (response) {
        cb(null, response);
      } else {
        workflow.emit('upworkRequest');
      }
    });
  });

  workflow.on('upworkRequest', function() {
    var request_data = {
        url: config.API_url + url,
        method: method,
        data: _.extend(opts.data || {}, token && { oauth_token: token })
      },
      urlDelimiter;

    request_data = oauth.authorize(request_data, {
      secret: token_secret
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
        try {
          JSON.parse(data);
        } catch (e) {
          log.captureMessage('Upwork is down');
          cb(null, 'upwork_is_down');
        } finally {
          cb(null, data);
          workflow.emit('saveCache', data);
        }
      });
    }).on('error', function(e) {
      log.captureError(e.message);
      cb(e.message);
    });
  });

  workflow.on('saveCache', function(data) {
    cache.store({
      id: cacheId,
      data,
      ttl: cacheTTL
    }, function(err) {
      if (err) {
        log.captureError(err);
      }
    });
  });

  workflow.emit('validateParams');
}

// ---------
// interface
// ---------

exports = module.exports = {
  request: pRequest
};
