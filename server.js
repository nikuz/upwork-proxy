'use strict';

var express = require('express'),
  env = require('dotenv'),
  app = express();

env.load(); // load __dirname/.env file

app.SERVER = process.env.SERVER_NAME;
app.PORT = process.env.PORT;

process.argv.forEach(function(val) {
  if (val === 'dev') {
    process.env.CURRENT_ENV = 'DEV';
  }
});

if (!process.env.CURRENT_ENV) {
  process.env.CURRENT_ENV = 'TEST';
}

console.log('Running %s server...', process.env.CURRENT_ENV);

require('./api/routes')(app);

app.listen(app.PORT, function() {
  console.log('%s:%d - %s', app.SERVER, app.PORT, new Date(Date.now()));
});

require('./notifier').start();
