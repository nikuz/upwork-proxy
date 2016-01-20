'use strict';

var _ = require('underscore'),
  async = require('async'),
  config = require('../config'),
  redis = require('redis');

exports = module.exports = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback,
    keys = [], metaKeys = [],
    client,
    currentEnv = process.env.NODE_ENV,
    dbPrefix = config.db_prefix,
    spentTime = new Date();

  workflow.on('DBInit', function() {
    var host = '127.0.0.1',
      password = '';

    if (currentEnv === 'PROD') {
      if (!process.env.REDIS_HOST || !process.env.REDIS_PASSWORD) {
        return cb('You should specify `REDIS_HOST` and `REDIS_PASSWORD` in your environment');
      }
      host = process.env.REDIS_HOST;
      password = process.env.REDIS_PASSWORD;
    }

    client = redis.createClient(6379, host);
    client.auth(password);
    client.on('error', function(err) {
      cb('Redis ' + err);
    });
    client.on('ready', function() {
      console.log('connected to redis server `%s`', host);
      workflow.emit('downloadKeys');
    });
  });

  workflow.on('downloadKeys', function() {
    console.log('Loading keys...');
    var zKeysReg = new RegExp('^' + dbPrefix + '(z:|s:|g_)\.+');
    client.keys(dbPrefix + '*', function(err, response) {
      if (err) {
        cb(err);
      } else {
        console.log('Downloaded %d keys', response.length);
        _.each(response, function(item) {
          if (zKeysReg.test(item)) {
            keys.push(item);
          } else {
            metaKeys.push(item);
          }
        });
        workflow.emit('calculateTopicsSize');
      }
    });
  });

  workflow.on('calculateTopicsSize', function() {
    function parseResponse(data, keys, topic) {
      data = data.split(' ');
      keys[keys.indexOf(topic)] = {
        topic: topic,
        encoding: data[3].replace('encoding:', ''),
        size: Number(data[4].replace('serializedlength:', ''))
      };
    }
    async.parallel([
      function(callback) {
        async.each(keys, function(topic, internalCallback) {
          client.debug('object', topic, function(err, response) {
            if (err) {
              internalCallback(err);
            } else {
              parseResponse(response, keys, topic);
              internalCallback();
            }
          });
        }, callback);
      },
      function(callback) {
        async.each(metaKeys, function(topic, internalCallback) {
          client.debug('object', topic, function(err, response) {
            if (err) {
              internalCallback(err);
            } else {
              parseResponse(response, metaKeys, topic);
              internalCallback();
            }
          });
        }, callback);
      }
    ], function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('finish');
      }
    });
  });

  workflow.on('finish', function() {
    var humanFriendlySize = function(size) {
      var ratio = 1024,
        iterations = 1;

      size /= ratio;
      while (size > 1024) {
        size /= ratio;
        iterations += 1;
      }
      size = size.toFixed(2);

      switch (iterations) {
        case 1:
          size += 'kb';
          break;
        case 2:
          size += 'mb';
          break;
        case 3:
          size += 'gb';
          break;
      }
      return size;
    };
    async.series([
      function(callback) {
        // sort
        var sortBySize = function(a, b) {
          if (a.size > b.size) {
            return -1;
          } else if (a.size < b.size) {
            return 1;
          } else {
            return 0;
          }
        };
        keys.sort(sortBySize);
        metaKeys.sort(sortBySize);
        callback();
      },
      function(callback) {
        // make size to human friendly
        _.each(keys, function(topic) {
          topic.hsize = humanFriendlySize(topic.size);
        });
        _.each(metaKeys, function(topic) {
          topic.hsize = humanFriendlySize(topic.size);
        });
        callback();
      },
      function(callback) {
        // print all stats
        var zSize = 0,
          metaSize = 0;

        _.each(keys, function(topic) {
          zSize += topic.size;
        });
        _.each(metaKeys, function(topic) {
          metaSize += topic.size;
        });
        console.log('Zlists db size: %s', humanFriendlySize(zSize));
        console.log('Meta db size: %s', humanFriendlySize(metaSize));
        console.log();
        callback();
      },
      function(callback) {
        // print tops
        var i = 0, l = 50;
        if (keys.length) {
          console.log('Zlists top %d:', l);
          for (; i < l; i += 1) {
            if (!keys[i]) {
              break;
            }
            console.log('%s %s (%s)', keys[i].hsize, keys[i].topic, keys[i].encoding);
          }
        }
        if (metaKeys.length) {
          i = 0;
          console.log('\nMeta top %d:', l);
          for (; i < l; i += 1) {
            if (!metaKeys[i]) {
              break;
            }
            console.log('%s %s (%s)', metaKeys[i].hsize, metaKeys[i].topic, metaKeys[i].encoding);
          }
        }
        callback();
      }
    ], function() {
      spentTime = ((new Date().getTime() - spentTime.getTime()) / 1000 / 60).toFixed(2);
      console.log('Spent time: %d minute', spentTime);
      cb();
    });
  });

  workflow.emit('DBInit');
};
