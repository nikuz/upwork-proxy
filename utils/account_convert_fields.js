'use strict';

var _ = require('underscore'),
  async = require('async'),
  db = require('../api/db'),
  ProgressBar = require('progress');

var userFieldsMap = {
  budgetFrom: 'number',
  budgetTo: 'number',
  daysPosted: 'number',
  notifyInterval: 'number',
  notifyAllow: 'boolean',
  useProxy: 'boolean',
  timezone: 'number'
};

var convertUserFields = function(data) {
  _.each(userFieldsMap, function(value, key) {
    switch (value) {
      case 'number':
        if (!_.isUndefined(data[key]) && !_.isNumber(data[key])) {
          data[key] = Number(data[key]);
        }
        break;
      case 'boolean':
        if (!_.isUndefined(data[key]) && !_.isBoolean(data[key])) {
          data[key] = data[key] === 'true';
        }
        break;
    }
  });
  return data;
};

exports = module.exports = function(options, callback) {
  var cb = callback,
    workflow = new(require('events').EventEmitter)(),
    usersInfo = [];

  workflow.on('downloadUsers', function() {
    console.log('Loading users data...');
    db.hgetall('users', function(err, response) {
      if (err) {
        cb(err);
      } else {
        _.each(response, function(item) {
          item = convertUserFields(JSON.parse(item));
          usersInfo.push(item);
        });
        workflow.emit('convertFields');
      }
    });
  });

  workflow.on('convertFields', function() {
    var i = 0, l = usersInfo.length,
      tenPercent = l > 100 ? l / 10 : 100 / 10;

    console.log('Convert fields for %d users', l);

    var bar = new ProgressBar('[:bar] :percent :etas', {
      complete: '=',
      incomplete: ' ',
      width: 100,
      total: l
    });
    bar.tick(0);
    async.eachSeries(usersInfo, function(user, internalCallback) {
      db.hset('users', user.id, user, internalCallback);
      i += 1;
      if (i >= tenPercent) {
        bar.tick(tenPercent);
        i = 0;
      }
    }, function(err) {
      bar.tick(l);
      if (err) {
        cb(err);
      } else {
        cb();
      }
    });
  });

  workflow.emit('downloadUsers');
};
