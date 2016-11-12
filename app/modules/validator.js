'use strict';

var _ = require('underscore'),
  async = require('async'),
  constants = require('../constants')();

// ----------------
// public functions
// ----------------

function pIsString(value) {
  if (!_.isString(value)) {
    return false;
  } else {
    return value.trim().length > 0;
  }
}

function pIsNumber(value) {
  return _.isNumber(value);
}

function pIsEmail(value) {
  return /^[^@.]+@[^@.]+\.[^@.]+$/.test(value);
}

function pIsArray(value) {
  return _.isArray(value);
}

function pIsObject(value) {
  return _.isObject(value);
}

function pIsDate(value) {
  value = new Date(value);
  return value.getTime();
}

function pIsFunction(value) {
  return _.isFunction(value);
}

function pIsBoolean(value) {
  return _.isBoolean(value);
}

/*
 structure for checking item
 {
    item_name: [
      'type',
      value,
      additionalRule1,
      additionalRuleN
    ]
 }
 Additional rules is optional fields. It's should be functions as for async.series loop:
 function(callback) {
  // checking stuff
  callback(err);
 }

 All together:
 validator.check({
    field1: ['string', field1_value],
    field2: ['email', field2_value],
    field3: [
      'number',
      field3_value,
      function() {
        // additional checking stuff
      }
    ],
 }, function(err) {

 });
 */
function pCheck(options, callback) {
  var opts = options || {},
    cb = callback || _.noop,
    errors = [],
    items,
    typesToChecking = [
      'string',
      'number',
      'email',
      'array',
      'object',
      'date',
      'function',
      'boolean',
      'any'
    ];

  items = _.map(opts, function(item, key) {
    return {
      options: item,
      key: key
    };
  });

  async.each(items, function(item, internalCallback) {
    if (!item.options) {
      return internalCallback();
    }
    var type = item.options[0],
      name = item.key,
      value = item.options[1],
      rules = item.options.splice(2, item.options.length - 1),
      typeError;

    if (!_.isString(type) || !_.contains(typesToChecking, type)) {
      errors.push(constants.VALIDATOR_WRONG_TYPE(type));
      return internalCallback();
    }
    if (rules.length && !_.every(rules, _.isFunction)) {
      errors.push(constants.VALIDATOR_WRONG_OPTIONS_FORMAT(name));
      return internalCallback();
    }

    switch (type) {
      case 'string':
        if (!pIsString(value)) {
          errors.push(constants.STRING_REQUIRED(name));
          typeError = true;
        }
        break;
      case 'number':
        if (!pIsNumber(value)) {
          errors.push(constants.NUMBER_REQUIRED(name));
          typeError = true;
        }
        break;
      case 'email':
        if (!pIsEmail(value)) {
          errors.push(constants.EMAIL_REQUIRED(name));
          typeError = true;
        }
        break;
      case 'array':
        if (!pIsArray(value)) {
          errors.push(constants.ARRAY_REQUIRED(name));
          typeError = true;
        }
        break;
      case 'object':
        if (!pIsObject(value)) {
          errors.push(constants.OBJECT_REQUIRED(name));
          typeError = true;
        }
        break;
      case 'date':
        if (!pIsDate(value)) {
          errors.push(constants.DATE_REQUIRED(name));
          typeError = true;
        }
        break;
      case 'function':
        if (!pIsFunction(value)) {
          errors.push(constants.FUNCTION_REQUIRED(name));
          typeError = true;
        }
        break;
      case 'boolean':
        if (!pIsBoolean(value)) {
          errors.push(constants.BOOLEAN_REQUIRED(name));
          typeError = true;
        }
        break;
      case 'any':
        if (_.isUndefined(value)) {
          errors.push(constants.REQUIRED(name));
          typeError = true;
        }
        break;
    }
    if (!typeError && rules.length) {
      async.series(rules, function(err) {
        if (err) {
          errors.push(err);
        }
        internalCallback();
      });
    } else {
      internalCallback();
    }
  }, function() {
    if (errors.length) {
      cb(errors);
    } else {
      cb();
    }
  });
}

// ---------
// interface
// ---------

exports = module.exports = {
  isString: pIsString,
  isNumber: pIsNumber,
  isEmail: pIsEmail,
  isArray: pIsArray,
  isObject: pIsObject,
  isDate: pIsDate,
  check: pCheck
};
