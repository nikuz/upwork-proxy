'use strict';

var _ = require('underscore'),
  current,
  dictionaryActions = {};

const dictionary = {
  DATABASE_ERROR: 'Database operation has failed',
  USER_NOT_FOUND: 'User not found',
  REQUIRED: '`%s` parameter is required',
  STRING_REQUIRED: '`%s` should be a not empty string',
  NUMBER_REQUIRED: '`%s` should be a number',
  EMAIL_REQUIRED: '`%s` should be an email string like `name@address.com`',
  ARRAY_REQUIRED: '`%s` should be an array',
  OBJECT_REQUIRED: '`%s` should be an object',
  DATE_REQUIRED: '`%s` should be a date',
  FUNCTION_REQUIRED: '`%s` should be a function',
  BOOLEAN_REQUIRED: '`%s` should be boolean',
  ONE_REQUIRED: 'You need to specify `%s1`',
  VALIDATOR_WRONG_TYPE: 'Validator wrong type `%s`',
  VALIDATOR_WRONG_OPTIONS_FORMAT: 'Validator wrong options format in `%s`',
  GREATER_THAN_ZERO_REQUIRED: '`%s` should be greater than 0',
  WRONG_TIMEZONE: 'Nonexistent time zone',
  UPWORK_REQUEST_ERROR: 'Upwork request error',
  APN_ERROR: 'APN error',
  APN_SOCKET_ERROR: 'APN socket error',
  FAILED_GET_NOTIFICATION_ID: 'Failed to get new notification ID',
  FAILED_SAVE_NOTIFICATION: 'Can\'t save notification',
  FAILED_TO_GET_FILEINFO: 'Failed to get file info',
  REDIS_DUMP_EMPTY: 'Redis dump is empty',
  PARAMETERS_WRONG_FORMAT: 'Format required: `%s`',
  MODULE_NOT_EXIST: 'Module `%s` does not exist',
  METHOD_NOT_EXIST: '`%s` method does not exist',
  ACCOUNT_UPDATE_FAILED: 'Failed account update'
};

class Parser {
  constructor(name) {
    this.name = name;
    return ((params) => this.action(params));
  }
  action(param) {
    if (_.isArray(param)) {
      var result = dictionary[this.name];
      _.each(param, function(str, index) {
        result = result.replace('%s' + (index + 1), str);
      });
      return result;
    }
    return dictionary[this.name].replace('%s', param);
  }
}

// ---------
// interface
// ---------

exports = module.exports = function() {
  if (!current) {
    _.each(dictionary, function(value, key) {
      dictionaryActions[key] = new Parser(key);
    });
    dictionaryActions.dictionary = dictionary;
  }
  return dictionaryActions;
};
