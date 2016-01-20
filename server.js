'use strict';

var express = require('express'),
  env = require('dotenv'),
  app = express();

env.load(); // load __dirname/.env file

app.SERVER = process.env.SERVER_NAME;
app.PORT = process.env.PORT;

process.argv.forEach(function(val) {
  if (val === 'prod') {
    process.env.NODE_ENV = 'PROD';
  }
});

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'DEV';
}

console.log('Running %s server...', process.env.NODE_ENV);

require('./app/routes')(app);

app.listen(app.PORT, function() {
  console.log('%s:%d - %s', app.SERVER, app.PORT, new Date(Date.now()));
});

require('./app/notifier').start();
