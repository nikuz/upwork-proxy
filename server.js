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
