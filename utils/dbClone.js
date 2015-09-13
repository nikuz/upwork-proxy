'use strict';

var _ = require('underscore'),
  async = require('async'),
  config = require('../config'),
  ProgressBar = require('progress'),
  redis = require('redis');

exports = module.exports = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback,
    keys, client, localClient,
    dbPrefix = config.db_prefix,
    currentEnv = process.env.CURRENT_ENV,
    spentTime = new Date();

  workflow.on('validateParams', function() {
    if (currentEnv === 'PROD' || currentEnv === 'DEV') {
      cb('This utility cannot be run on ' + currentEnv + ' environment. Set the target database for clone by `args`');
    } else {
      workflow.emit('localDBInit');
    }
  });

  workflow.on('localDBInit', function() {
    localClient = redis.createClient(6379, '127.0.0.1');
    localClient.on('error', function(err) {
      cb('Redis ' + err);
    });
    localClient.on('ready', function() {
      console.log('connected to local redis server');
      localClient.keys(dbPrefix + '*', function(err, keys) {
        async.each(keys, function(key, internalCallback) {
          localClient.del(key, internalCallback);
        }, function(err) {
          if (err) {
            cb(err);
          } else {
            workflow.emit('remoteDBInit');
          }
        });
      });
    });
  });

  workflow.on('remoteDBInit', function() {
    if (!config.db_remote_host || !config.db_password) {
      return cb('You should specify `db_remote_host` and `db_password` in config');
    }
    client = redis.createClient(6379, config.db_remote_host);
    client.auth(config.db_password);

    client.on('error', function(err) {
      cb('Redis ' + err);
    });
    client.on('ready', function() {
      workflow.emit('downloadKeys');
    });
  });

  workflow.on('downloadKeys', function() {
    console.log('Loading keys...');
    client.keys(dbPrefix + '*', function(err, response) {
      if (err) {
        cb(err);
      } else {
        keys = response;
        console.log('Downloaded %d keys', keys.length);
        workflow.emit('cloneDB');
      }
    });
  });

  workflow.on('cloneDB', function() {
    console.log('Clone DB...');
    var gTopicsReg = new RegExp('^' + dbPrefix + '(s:|g_)'),
      zTopicsReg = new RegExp('^' + dbPrefix + 'z:'),
      i = 0, l = keys.length || 1,
      bar = new ProgressBar('[:bar] :percent :etas', {
        complete: '=',
        incomplete: ' ',
        width: 100,
        total: l
      });

    bar.tick(0);

    async.each(keys, function(topic, callback) {
      async.waterfall([
        function(internalCallback) {
          if (gTopicsReg.test(topic)) {
            client.get(topic, internalCallback);
          } else if (zTopicsReg.test(topic)) {
            client.zrevrange(topic, 0, -1, 'withscores', internalCallback);
          } else {
            client.hgetall(topic, internalCallback);
          }
        },
        function(data, internalCallback) {
          var multi = localClient.multi();
          if (gTopicsReg.test(topic)) {
            multi.set(topic, data);
          }  else if (zTopicsReg.test(topic)) {
            var i = 0, l = data.length;
            for (; i < l; i += 2) {
              multi.zadd(topic, Number(data[i + 1]), data[i]);
            }
          } else {
            _.each(data, function(item, key) {
              multi.hset(topic, key, item);
            });
          }
          multi.exec(internalCallback);
        }
      ], function(err) {
        if (err) {
          callback(err);
        } else {
          i += 1;
          if (i >= l / 100) {
            bar.tick(l / 100);
            i = 0;
          }
          callback();
        }
      });
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        spentTime = ((new Date().getTime() - spentTime.getTime()) / 1000 / 60).toFixed(2);
        console.log('\nClone done!');
        console.log('Spent time: %d minute', spentTime);
        cb();
      }
    });
  });

  workflow.emit('validateParams');
};
