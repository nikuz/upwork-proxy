'use strict';

var dictionary = {
  DATABASE_ERROR: 'Database operation has failed',
  USER_NOT_FOUND: 'User not found',
  REQUIRED: '`%s` parameter is required',
  ARRAY_REQUIRED: '`%s` should be an array',
  ONE_REQUIRED: 'At least one required: %s',
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
  METHOD_NOT_EXIST: '`%s` method does not exist'
};

// ----------------
// public methods
// ----------------

var pGet = function(entry, vars) {
  if (vars instanceof Array) {
    vars = vars.join(', ');
  }
  return dictionary[entry].replace('%s', vars);
};

// ---------
// interface
// ---------

exports = module.exports = {
  get: pGet
};

