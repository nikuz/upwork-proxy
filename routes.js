'use strict';

var controllers = require('./controllers/index'),
  bodyParser = require('body-parser'),
  urlencodeParser = bodyParser.urlencoded({ extended: false });

exports = module.exports = function(app) {
  app.get('/jobs', controllers.jobs.list);
  app.post('/account', urlencodeParser, controllers.account.create);
  app.post('/account/:userid', urlencodeParser, controllers.account.update);
};
