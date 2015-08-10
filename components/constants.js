'use strict';

var dictionary = {
  DATABASE_ERROR: 'Database operation has failed',
  USER_NOT_FOUND: 'User not found',
  REQUIRED: '`%s` parameter is required',
  ONE_REQUIRED: 'At least one required: %s',
  WRONG_TIMEZONE: 'Nonexistent time zone',
  UPWORK_REQUEST_ERROR: 'Upwork request error',
  APN_ERROR: 'APN error',
  APN_SOCKET_ERROR: 'APN socket error',
  FAILED_GET_NOTIFICATION_ID: 'Failed to get new notification ID',
  FAILED_SAVE_NOTIFICATION: 'Can\'t save notification'
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

