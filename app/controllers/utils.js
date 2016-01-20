'use strict';

var fs = require('fs'),
  path = require('path');

// ----------------
// public functions
// ----------------

var pStoreApi = function(req, res) {
  var body = req.body || {},
    apiText = body.toString(),
    result = {},
    err;

  if (process.env.NODE_ENV !== 'DEV') {
    err = 'Can work only in `DEV` evn';
  }
  if (!apiText.length) {
    err = 'Empty data';
  }

  if (err) {
    result.error = err;
  } else {
    fs.writeFile(path.join(__dirname, '../../api.yaml'), body);
    result = {
      success: true
    };
  }
  res.send(result);
};

// ---------
// interface
// ---------

exports = module.exports = {
  storeApi: pStoreApi
};
