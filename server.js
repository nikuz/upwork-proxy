'use strict';

var config = require('./config.json'),
  express = require('express'),
  _ = require('underscore'),
  upwork = require('./modules/upwork'),
  email = require('./modules/email')(),
  app = express(),
  PORT = Number(process.env.PORT || 8020),
  SERVER = String(process.env.SERVER_NAME || 'localhost');

app.SERVER = SERVER;
app.PORT = PORT;

var responseSend = function(res, err, data) {
  var result = {};
  if (err) {
    result.error = err;
  } else {
    result = data;
  }
  res.send(result);
};

app.get('/jobs', function(req, res) {
  var feeds = req.query.q;
  if (!feeds) {
    return responseSend(res, '`q` required');
  }

  var queryFields = _.pick(req.query, [
    'q',
    'budget',
    'days_posted',
    'duration',
    'job_type',
    'workload',
    'paging'
  ]);
  upwork.request({
    url: config.API_jobs_url,
    dataType: 'json',
    data: queryFields
  }, function(err, response) {
    if (err) {
      responseSend(res, err);
      email.send(config.admin_email, 'Upwork request error', err);
    } else {
      responseSend(res, null, response);
    }
  });
});

app.listen(app.PORT, function() {
  console.log('%s: Node server started on %s:%d ...', new Date(Date.now()), app.SERVER, app.PORT);
});
