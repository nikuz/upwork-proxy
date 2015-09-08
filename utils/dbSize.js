'use strict';

var _ = require('underscore'),
  async = require('async'),
  config = require('../config'),
  ProgressBar = require('progress'),
  redis = require('redis');

exports = module.exports = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    opts = options || {},
    cb = callback,
    keys, metaKeys,
    client, localClient,
    targetDb = opts.target,
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
      if (targetDb) {
        workflow.emit('remoteDBInit');
      } else {
        workflow.emit('downloadLocalKeys');
      }
    });
  });

  workflow.on('remoteDBInit', function() {
    var port, address, password;
    targetDb = targetDb.toUpperCase();
    switch (targetDb) {
      case 'DEV':
        port = 6379;
        address = config.db_remote_host;
        password = config.db_password;
        break;
    }

    client = redis.createClient(port, address);
    client.auth(password);

    client.on('error', function(err) {
      cb('Redis ' + err);
    });
    client.on('ready', function() {
      localClient.keys(dbPrefix + '*', function(err, keys) {
        async.each(keys, function(key, internalCallback) {
          localClient.del(key, internalCallback);
        }, function(err) {
          if (err) {
            cb(err);
          } else {
            workflow.emit('downloadKeys');
          }
        });
      });
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
      i = 0, l = keys.length,
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
        console.log('\nClone done!');
        workflow.emit('downloadLocalKeys');
      }
    });
  });

  workflow.on('downloadLocalKeys', function() {
    console.log('Loading local keys...');
    keys = [];
    metaKeys = [];
    var zKeysReg = new RegExp('^' + dbPrefix + '(z:|s:|g_)\.+');
    localClient.keys(dbPrefix + '*', function(err, response) {
      if (err) {
        cb(err);
      } else {
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
          localClient.debug('object', topic, function(err, response) {
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
          localClient.debug('object', topic, function(err, response) {
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

  workflow.emit('validateParams');
};
