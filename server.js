'use strict';

var express = require('express'),
  app = express(),
  PORT = Number(process.env.PORT || 8020),
  SERVER = String(process.env.SERVER_NAME || 'localhost');

app.SERVER = SERVER;
app.PORT = PORT;

require('./routes')(app);

app.listen(app.PORT, function() {
  console.log('%s: Node server started on %s:%d ...', new Date(Date.now()), app.SERVER, app.PORT);
});

var getRandomFromRange = function(min, max) {
  return Math.random() * (max - min) + min;
};

// exit node every 30-45 minutes. This is going to help with fixing memory leaks
setTimeout(function() {
  console.log('Planned shutdown...');
  process.exit(1);
}, getRandomFromRange(30, 45) * 60 * 1000);
