'use strict';

var express = require('express'),
  swagger = require('swagger-express-mw'),
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

var config = {
  appRoot: __dirname // required config
};

swagger.create(config, function(err, swaggerExpress) {
  if (err) {
    throw err;
  }

  // install middleware
  //swaggerExpress.register(app);

  app.listen(app.PORT, function() {
    console.log('%s:%d - %s', app.SERVER, app.PORT, new Date(Date.now()));
  });
});

var notifier = require('./notifier');
notifier.start();

var getRandomFromRange = function(min, max) {
  return Math.random() * (max - min) + min;
};

// exit node every 30-45 minutes. This is going to help with fixing memory leaks
setTimeout(function() {
  notifier.checkInProgress(function() {
    console.log('Planned shutdown...');
    process.exit(1);
  });
}, getRandomFromRange(30, 45) * 60 * 1000);
