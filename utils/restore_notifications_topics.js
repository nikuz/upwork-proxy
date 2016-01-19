'use strict';

var _ = require('underscore'),
  async = require('async'),
  db = require('../api/db'),
  account = require('../api/models/account'),
  ProgressBar = require('progress');

exports = module.exports = function(grunt, done) {
  var workflow = new(require('events').EventEmitter)(),
    usersInfo = [];

  workflow.on('downloadUsers', function() {
    console.log('Loading users data...');
    db.hgetall('users', function(err, response) {
      if (err) {
        grunt.log.error(err);
        done(false);
      } else {
        _.each(response, function(item) {
          usersInfo.push(JSON.parse(item));
        });
        workflow.emit('convertFields');
      }
    });
  });

  workflow.on('convertFields', function() {
    var i = 0, l = usersInfo.length,
      tenPercent = l > 100 ? l / 10 : 100 / 10,
      enabledUsers = 0,
      disabledUsers = 0;

    console.log('Restore notifications time topics for %d users', l);

    var bar = new ProgressBar('[:bar] :percent :etas', {
      complete: '=',
      incomplete: ' ',
      width: 100,
      total: l
    });
    bar.tick(0);
    async.eachSeries(usersInfo, function(user, internalCallback) {
      if (user.notifyAllow && user.updated && Date.now() - new Date(user.updated).getTime() < 864e5 * 2 && user.push_id) {
        enabledUsers += 1;
        account.fillMinutes({
          userid: user.id,
          interval: user.notifyInterval,
          timezone: user.timezone,
          dndFrom: user.dndFrom,
          dndTo: user.dndTo
        }, internalCallback);
      } else {
        disabledUsers += 1;
        account.fillMinutes({
          userid: user.id,
          interval: user.notifyInterval,
          timezone: user.timezone,
          disable: true
        }, internalCallback);
      }
      i += 1;
      if (i >= tenPercent) {
        bar.tick(tenPercent);
        i = 0;
      }
    }, function(err) {
      bar.tick(l);
      if (err) {
        grunt.log.error(err);
        done(false);
      } else {
        console.log('Enabled: %d', enabledUsers);
        console.log('Disabled: %d', disabledUsers);
        done();
      }
    });
  });

  workflow.emit('downloadUsers');
};
