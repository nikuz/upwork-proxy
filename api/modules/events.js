'use strict';

var _ = require('underscore'),
  async = require('async'),
  constants = require('../components/constants'),
  modules = require('./index');

var noop = function() {};


function validate(eventItem) {
  var operation = eventItem.operation,
    params = eventItem.params,
    module, method,
    errors = [];

  if (!params) {
    errors.push(constants.get('REQUIRED', 'params'));
  }

  if (!operation) {
    errors.push(constants.get('REQUIRED', 'operation'));
  } else {
    operation = operation.split('.');
    if (operation.length !== 2) {
      errors.push(constants.get('PARAMETERS_WRONG_FORMAT', 'moduleName.methodName'));
    } else {
      module = modules[operation[0]];
      if (!module) {
        errors.push(constants.get('MODULE_NOT_EXIST', operation[0]));
      } else {
        method = operation[1];
        if (!module[method]) {
          errors.push(constants.get('METHOD_NOT_EXIST', eventItem.operation));
        }
      }
    }
  }

  return {
    errors: errors
  };
}

// ----------------
// public functions
// ----------------

var pReplay = function(eventsStack, callback) {
  var cb = callback || noop;
  if (!_.isArray(eventsStack)) {
    cb(constants.get('ARRAY_REQUIRED', 'eventsStack'));
  } else {
    var results = [];
    async.eachSeries(
      eventsStack,
      function(eventItem, internalCallback) {
        var validationResult = validate(eventItem);
        if (!validationResult.errors.length) {
          var operation = eventItem.operation.split('.'),
            module = operation[0],
            method = operation[1];

          modules[module][method](eventItem.params, function(err, response) {
            if (err) {
              if (_.isArray(err)) {
                err = err.join('\n');
              } else if (_.isObject(err)) {
                err = JSON.stringify(err);
              }
              console.log('Events replay errors in %s.%s:', module, method);
              console.log('\x1b[31m%s\x1b[0m', err);
            }
            results.push(response);
            internalCallback();
          });
        } else {
          internalCallback(validationResult.errors);
        }
      },
      function(err) {
        if (err) {
          cb(err);
        } else {
          cb(null, {
            success: true,
            results: results
          });
        }
      }
    );
  }
};

// ---------
// interface
// ---------

exports = module.exports = {
  replay: pReplay
};
