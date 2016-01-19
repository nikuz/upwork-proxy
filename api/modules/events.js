'use strict';

var _ = require('underscore'),
  async = require('async'),
  constants = require('../constants')(),
  controllers = require('../controllers/'),
  models = require('../models/'),
  request = require('../request'),
  baseUrl = 'http://localhost:8020',
  EventEmitter = require('events').EventEmitter;

/*
 structure for http event
 {
 "method": "post",
 "route": "/account/create",
 "params": {}
 }
 */
var replayHttpRequest = function(options, callback) {
  var workflow = new EventEmitter(),
    cb = callback || _.noop,
    opts = options || {},
    route = opts.route,
    method = opts.method,
    params = opts.params;

  workflow.on('validateParams', function() {
    var errors = [];
    if (!method) {
      errors.push(constants.REQUIRED('method'));
    }
    if (!params) {
      errors.push(constants.REQUIRED('params'));
    }
    if (!route || route === '') {
      errors.push(constants.REQUIRED('route'));
    }
    if (errors.length) {
      cb(errors);
    } else {
      workflow.emit('request');
    }
  });

  workflow.on('request', function() {
    var requestObj,
      responseStatus,
      responseHandler = function(err, response) {
        if (err) {
          cb(err);
        } else if (response.error) {
          cb(response.error);
        } else if (!_.isUndefined(responseStatus)) {
          cb(responseStatus);
        } else {
          cb(null, response.result);
        }
      };

    switch (method) {
      case 'get':
      case 'del':
        requestObj = request[method](baseUrl + route, params, null, responseHandler);
        break;
      case 'post':
      case 'put':
        requestObj = request[method](baseUrl + route, null, null, params, responseHandler);
    }
    requestObj.on('response', function(response) {
      if (response.statusCode !== 200) {
        responseStatus = response.statusMessage;
      }
    });
  });

  workflow.emit('validateParams');
};

/*
 structure for controller event
 {
 "controllerOperation": "account.create",
 "params": {}
 }
 */
var replayControllerWork = function(options, callback) {
  var workflow = new EventEmitter(),
    cb = callback || _.noop,
    opts = options || {},
    operation = (opts.controllerOperation || '').split('.'),
    controller = operation[0],
    method = operation[1],
    params = opts.params;

  workflow.on('validateParams', function() {
    var errors = [];
    if (!params) {
      errors.push(constants.REQUIRED('params'));
    }
    if (!controller || !controllers[controller]) {
      errors.push(constants.CONTROLLER_NOT_EXIST(controller));
    } else if (!method || !controllers[controller][method]) {
      errors.push(constants.METHOD_NOT_EXIST(method));
    }
    if (errors.length) {
      cb(errors);
    } else {
      workflow.emit('work');
    }
  });

  workflow.on('work', function() {
    var req = {
      query: {
        format: 'json'
      },
      params: params,
      body: params
    };
    if (params.userid) {
      _.extend(req, {
        user: {
          id: params.userid
        }
      });
    }
    var res = {
      send: function(data) {
        cb(null, data);
      }
    };

    controllers[controller][method](req, res);
  });

  workflow.emit('validateParams');
};

/*
 structure for model event
 {
 "modelOperation": "account.create",
 "params": {}
 }
 */
var replayModelWork = function(options, callback) {
  var cb = callback || _.noop,
    opts = options || {},
    operation = (opts.modelOperation || '').split('.'),
    model = operation[0],
    method = operation[1],
    params = opts.params,
    errors = [];

  if (!params) {
    errors.push(constants.REQUIRED('params'));
  }
  if (!model || !models[model]) {
    errors.push(constants.MODEL_NOT_EXIST(model));
  } else if (!method || !models[model][method]) {
    errors.push(constants.METHOD_NOT_EXIST(method));
  }
  if (errors.length) {
    cb(errors);
  } else {
    models[model][method](params, cb);
  }
};

// ----------------
// public functions
// ----------------

var pReplay = function(eventsStack, callback) {
  var cb = callback || _.noop;
  if (!_.isArray(eventsStack)) {
    cb(constants.ARRAY_REQUIRED('first argument'));
  } else {
    var results = [];
    async.eachSeries(eventsStack, function(eventItem, internalCallback) {
      if (eventItem.controllerOperation) {
        replayControllerWork(eventItem, function(err, response) {
          if (err) {
            internalCallback(err);
          } else {
            results.push(response);
            internalCallback();
          }
        });
      } else if (eventItem.modelOperation) {
        replayModelWork(eventItem, function(err, response) {
          if (err) {
            internalCallback(err);
          } else {
            results.push(response);
            internalCallback();
          }
        });
      } else if (eventItem.route) {
        replayHttpRequest(eventItem, function(err, response) {
          if (err) {
            internalCallback(err);
          } else {
            results.push(response);
            internalCallback();
          }
        });
      } else {
        internalCallback();
      }
    }, function(err) {
      if (err) {
        if (_.isArray(err)) {
          err = err.join('\n');
        } else if (err.toString() !== '[object Object]') {
          err = err.toString();
        } else if (_.isObject(err)) {
          err = JSON.stringify(err);
        }
        console.log('\x1b[31m%s\x1b[0m', err);
        cb(err);
      } else {
        cb(null, results);
      }
    });
  }
};

// ---------
// interface
// ---------

exports = module.exports = {
  replay: pReplay
};
