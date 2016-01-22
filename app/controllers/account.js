'use strict';

var _ = require('underscore'),
  async = require('async'),
  account = require('../models/account'),
  validator = require('../modules/validator'),
  EventEmitter = require('events').EventEmitter;

// ----------------
// public functions
// ----------------

function pCreate(req, res) {
  var body = req.body || {};
  account.create({
    id: body.id,
    os: body.os,
    category2: body.category2,
    budgetFrom: body.budgetFrom,
    budgetTo: body.budgetTo,
    daysPosted: body.daysPosted,
    duration: body.duration,
    jobType: body.jobType,
    workload: body.workload,
    notifyInterval: body.notifyInterval,
    notifyAllow: body.notifyAllow,
    dndFrom: body.dndFrom,
    dndTo: body.dndTo,
    useProxy: body.useProxy,
    timezone: body.timezone
  }, function(err, response) {
    var result = {};
    if (err) {
      result.error = err;
    } else {
      result = response;
    }
    res.send(result);
  });
}

function pAccountGet(req, res) {
  account.get({
    userid: req.params.userid
  }, function(err, response) {
    var result = {};
    if (err) {
      result.error = err;
    } else {
      result = response;
    }
    res.send(result);
  });
}

function pLogin(req, res) {
  var workflow = new EventEmitter(),
    body = req.body || {},
    cb = function(err, response) {
      var result = {};
      if (err) {
        result.error = err;
      } else {
        result = response;
      }
      res.send(result);
    },
    userid = req.params.userid,
    timezone = body.timezone,
    userinfo;

  workflow.on('validateParams', function() {
    validator.check({
      userid: ['string', userid, function(internalCallback) {
        account.get({
          userid
        }, function(err, response) {
          if (err) {
            internalCallback(err);
          } else {
            userinfo = response;
            internalCallback();
          }
        });
      }],
      timezone: ['number', timezone]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('login');
      }
    });
  });

  workflow.on('login', function() {
    account.login({
      userid: userid
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('checkNotificationsIntervals');
      }
    });
  });

  workflow.on('checkNotificationsIntervals', function() {
    if (timezone !== userinfo.timezone) {
      async.parallel([
        function(internalCallback) {
          account.updateNotificationsInterval({
            userid,
            interval: userinfo.notifyInterval,
            timezone: timezone,
            prevTimezone: userinfo.timezone
          }, internalCallback);
        },
        function(internalCallback) {
          account.update({
            userid,
            timezone
          }, internalCallback);
        }
      ], function(err) {
        if (err) {
          cb(err);
        } else {
          cb(null, {
            success: true
          });
        }
      });
    } else {
      cb(null, {
        success: true
      });
    }
  });

  workflow.emit('validateParams');
}

function pAddUpworkToken(req, res) {
  var workflow = new EventEmitter(),
    body = req.body || {},
    cb = function(err, response) {
      var result = {};
      if (err) {
        result.error = err;
      } else {
        result = response;
      }
      res.send(result);
    },
    userid = req.params.userid,
    token = body.token,
    token_secret = body.token_secret;

  workflow.on('validateParams', function() {
    validator.check({
      userid: ['string', userid],
      token: ['string', token],
      token_secret: ['string', token_secret]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('update');
      }
    });
  });

  workflow.on('update', function() {
    account.update({
      userid,
      token,
      token_secret
    }, function(err) {
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
}

function pAddFeeds(req, res) {
  var workflow = new EventEmitter(),
    cb = function(err, response) {
      var result = {};
      if (err) {
        result.error = err;
      } else {
        result = response;
      }
      res.send(result);
    },
    body = req.body || {},
    userid = req.params.userid,
    feeds = (body.feeds || '').trim(),
    userinfo,
    firstAdded;

  workflow.on('validateParams', function() {
    validator.check({
      userid: ['string', userid, function(internalCallback) {
        account.get({
          userid
        }, function(err, response) {
          if (err) {
            internalCallback(err);
          } else {
            userinfo = response;
            internalCallback();
          }
        });
      }],
      feeds: ['string', feeds, function(internalCallback) {
        var maxFeedsLength = 50;
        if (feeds.length > maxFeedsLength) {
          feeds = feeds.substring(0, maxFeedsLength);
        }
        internalCallback();
      }]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('update');
      }
    });
  });

  workflow.on('update', function() {
    if (!userinfo.feeds) {
      firstAdded = true;
    }
    var prevFeeds = [];
    if (userinfo.feeds && userinfo.feeds !== feeds) { // collect all user's feeds for statistics
      if (userinfo.prevFeeds) {
        prevFeeds = _.clone(userinfo.prevFeeds);
      }
      prevFeeds.push(feeds);
      prevFeeds = _.uniq(prevFeeds);
    }
    account.update({
      userid,
      feeds,
      prevFeeds
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('checkNotificationsIntervals');
      }
    });
  });

  workflow.on('checkNotificationsIntervals', function() {
    if (!firstAdded || !userinfo.notifyAllow) {
      cb(null, {
        success: true
      });
    } else {
      account.updateNotificationsInterval({
        userid,
        interval: userinfo.notifyInterval,
        timezone: userinfo.timezone
      }, function(err) {
        if (err) {
          cb(err);
        } else {
          cb(null, {
            success: true
          });
        }
      });
    }
  });

  workflow.emit('validateParams');
}

function pUpdateSettings(req, res) {
  var workflow = new EventEmitter(),
    body = req.body || {},
    cb = function(err, response) {
      var result = {};
      if (err) {
        result.error = err;
      } else {
        result = response;
      }
      res.send(result);
    },
    userid = req.params.userid,
    userinfo;

  workflow.on('validateParams', function() {
    validator.check({
      userid: ['string', userid, function(internalCallback) {
        account.get({
          userid
        }, function(err, response) {
          if (err) {
            internalCallback(err);
          } else {
            userinfo = response;
            internalCallback();
          }
        });
      }],
      category2: ['string', body.category2],
      budgetFrom: ['number', body.budgetFrom],
      budgetTo: ['number', body.budgetTo],
      duration: ['string', body.duration],
      jobType: ['string', body.jobType],
      workload: ['string', body.workload],
      notifyInterval: ['number', body.notifyInterval],
      notifyAllow: ['boolean', body.notifyAllow],
      dndFrom: ['string', body.dndFrom],
      dndTo: ['string', body.dndTo],
      useProxy: ['boolean', body.useProxy]
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('update');
      }
    });
  });

  workflow.on('update', function() {
    account.update({
      userid: userid,
      category2: body.category2,
      budgetFrom: body.budgetFrom,
      budgetTo: body.budgetTo,
      daysPosted: body.daysPosted,
      duration: body.duration,
      jobType: body.jobType,
      workload: body.workload,
      notifyInterval: body.notifyInterval,
      notifyAllow: body.notifyAllow,
      dndFrom: body.dndFrom,
      dndTo: body.dndTo,
      useProxy: body.useProxy
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        workflow.emit('updateNotificationsInterval');
      }
    });
  });

  workflow.on('updateNotificationsInterval', function() {
    var updateInterval = function(options) {
      _.extend(options, {
        userid: userid
      });
      account.updateNotificationsInterval(options, function(err) {
        if (err) {
          cb(err);
        } else {
          cb(null, {
            success: true
          });
        }
      });
    };

    if (!userinfo.feeds) {
      cb(null, {
        success: true
      });
    } else if (body.notifyAllow === false && userinfo.notifyAllow === true) {
      // if user disable notifications when it was enabled
      updateInterval({
        timezone: userinfo.timezone
      });
    } else if (body.notifyAllow === true && (userinfo.notifyAllow === false || body.notifyInterval !== userinfo.notifyInterval || body.dndFrom !== userinfo.dndFrom || body.dndTo !== userinfo.dndTo)) {
      // if user changed notification interval
      // or enabled notifications when it was disabled
      // or changed "Do not disturb" interval
      updateInterval({
        prevInterval: userinfo.notifyInterval,
        interval: body.notifyInterval,
        timezone: body.timezone,
        dndFrom: body.dndFrom,
        dndTo: body.dndTo
      });
    } else {
      cb(null, {
        success: true
      });
    }
  });

  workflow.emit('validateParams');
}

function pStats(req, res) {
  account.stats({
    userid: req.params.userid
  }, function(err, response) {
    var result = {};
    if (err) {
      result.error = err;
    } else {
      result = response;
    }
    res.send(result);
  });
}

// ---------
// interface
// ---------

exports = module.exports = {
  create: pCreate,
  accountGet: pAccountGet,
  login: pLogin,
  addUpworkToken: pAddUpworkToken,
  addFeeds: pAddFeeds,
  updateSettings: pUpdateSettings,
  stats: pStats
};
