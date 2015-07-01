'use strict';

var _ = require('underscore'),
  db = require('../components/db');

var noop = function() {};

var getFeedsName = function(feeds) {
  return feeds.trim().replace(/\s+/, '_');
};

// ----------------
// public functions
// ----------------

var pCreate = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback || noop,
    opts = options || {},
    userid = opts.id;

  workflow.on('validateParams', function() {
    var errors = [];
    _.each(opts, function(field, key) {
      if (_.isUndefined(opts[key])) {
        errors.push(key +' is required');
      }
    });
    if (errors.length) {
      cb(errors);
    } else {
      workflow.emit('checkUser');
    }
  });

  workflow.on('checkUser', function() {
    db.hget('users', userid, function(err, response) {
      if (err) {
        cb(err);
      } else if(response) {
        cb('User already exist');
      } else {
        workflow.emit('saveUser');
      }
    });
  });

  workflow.on('saveUser', function() {
    _.each(opts, function(value, key) {
      opts[key] = _.escape(value);
    });
    var userInfo = _.extend(opts, {
      created: new Date().toISOString()
    });
    db.hset('users', userid, userInfo, function(err) {
      if (err) {
        cb(err);
      } else {
        cb(null, {
          success: true
        });
      }
    });
  });

  workflow.emit('validateParams');
};

var pUpdate = function(options, callback) {
  var workflow = new(require('events').EventEmitter)(),
    cb = callback || noop,
    opts = options || {},
    userid = opts.userid,
    userinfo;

  workflow.on('checkUser', function() {
    db.hget('users', userid, function(err, response) {
      if (err) {
        cb(err);
      } else if(!response) {
        cb('User not found');
      } else {
        userinfo = response;
        if (opts.feeds) {
          workflow.emit('feedsWork');
        } else {
          workflow.emit('updateUserInfo');
        }
      }
    });
  });

  workflow.on('feedsWork', function() {
    if (userinfo.feeds && userinfo.feeds !== opts.feeds) {
      // remove user from previous group
      db.zrem('users:' + getFeedsName(userinfo.feeds), userinfo.id, function(err) {
        if (err) {
          cb(err);
        } else {
          addUserToNewGroup();
        }
      });
    } else {
      addUserToNewGroup();
    }

    function addUserToNewGroup() {
      var groupName = _.escape(getFeedsName(opts.feeds));
      db.zadd('users:' + groupName, 0, userinfo.id, function(err) {
        if (err) {
          cb(err);
        } else {
          workflow.emit('updateUserInfo');
        }
      });
    }
  });

  workflow.on('updateUserInfo', function() {
    _.each(opts, function(value, key) {
      opts[key] = _.escape(value);
    });
    userinfo = _.extend(userinfo, opts, {
      updated: new Date().toISOString()
    });
    db.hset('users', userid, userinfo, function(err, response) {
      if (err) {
        cb(err);
      } else {
        //responseSend(res, null, {
        //  success: true
        //});
        cb(null, userinfo);
      }
    });
  });

  workflow.emit('checkUser');
};

// ---------
// interface
// ---------

exports = module.exports = {
  create: pCreate,
  update: pUpdate
};
