'use strict';

var express = require('express'),
  swagger = require('swagger-express-mw'),
  app = express(),
  PORT = Number(process.env.PORT || 8020),
  SERVER = String(process.env.SERVER_NAME || 'localhost'),
  DEV, PROD;

app.SERVER = SERVER;
app.PORT = PORT;

process.argv.forEach(function(val) {
  switch (val) {
    case 'dev':
      DEV = true;
      break;
    case 'prod':
      PROD = true;
      break;
  }
});

if (DEV) {
  console.log('Running DEV server...');
  process.env.CURRENT_ENV = 'DEV';
} else if (PROD) {
  console.log('Running PROD server...');
  process.env.CURRENT_ENV = 'PROD';
} else {
  console.log('Running TEST server...');
  process.env.CURRENT_ENV = 'TEST';
}

require('./api/routes')(app);

var config = {
  appRoot: __dirname // required config
};

swagger.create(config, function(err, swaggerExpress) {
  if (err) { throw err; }

  // install middleware
  swaggerExpress.register(app);

  app.listen(app.PORT, function() {
    console.log('%s:%d - %s', app.SERVER, app.PORT, new Date(Date.now()));
  });
});

require('./notifier').start();

var getRandomFromRange = function(min, max) {
  return Math.random() * (max - min) + min;
};

// exit node every 30-45 minutes. This is going to help with fixing memory leaks
setTimeout(function() {
  console.log('Planned shutdown...');
  process.exit(1);
}, getRandomFromRange(30, 45) * 60 * 1000);
