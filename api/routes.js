'use strict';

var express = require('express'),
  controllers = require('./controllers/index'),
  bodyParser = require('body-parser'),
  urlencodeParser = bodyParser.urlencoded({
    extended: false
  }),
  jsonParser = bodyParser.json();

exports = module.exports = function(app) {
  // proxy
  app.get('/jobs', controllers.jobs.list);
  app.get('/api/profiles/v1/jobs/:id.json', controllers.jobs.get);
  app.get('/api/profiles/v2/search/jobs.json', controllers.jobs.list);
  app.get('/api/profiles/v2/metadata/categories.json', controllers.jobs.categoriesList);

  // account
  app.post('/account', urlencodeParser, jsonParser, controllers.account.create);
  app.post('/account/:userid', urlencodeParser, jsonParser, controllers.account.update); // Needed for old android builds
  app.put('/account/:userid', urlencodeParser, jsonParser, controllers.account.update);
  app.get('/accounts/:userid', controllers.account.get);

  // clients debug
  app.post('/debug/:userid', jsonParser, controllers.debug.store);
  app.get('/debug/:userid', jsonParser, controllers.debug.get);

  // swagger
  app.use('/docs', express.static('public/swagger'));
  app.use('/swagger.yaml', express.static('api/swagger/swagger.yaml'));
};
