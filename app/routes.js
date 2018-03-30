'use strict';

var express = require('express'),
  bodyParser = require('body-parser'),
  controllers = require('./controllers/index'),
  path = require('path');

exports = module.exports = function(app) {
  // settings
  app.use(bodyParser.urlencoded({
    extended: false
  }));
  app.use(bodyParser.raw({
    type: 'application/yaml'
  }));
  app.use(bodyParser.json());

  // account
  app.post('/accounts', controllers.account.create);
  app.get('/accounts/:userid', controllers.account.accountGet);
  app.put('/accounts/:userid/login', controllers.account.login);
  app.put('/accounts/:userid/token', controllers.account.addUpworkToken);
  app.put('/accounts/:userid/feeds', controllers.account.addFeeds);
  app.put('/accounts/:userid/settings', controllers.account.updateSettings);
  app.put('/accounts/:userid/last_job_date', controllers.account.updateLastJobDate);
  app.get('/accounts/:userid/stats', controllers.account.stats);
  app.post('/accounts/:userid/debug', controllers.debug.store);
  app.get('/accounts/:userid/debug', controllers.debug.get);

  // jobs
  app.get('/api/profiles/v1/jobs/:id.json', controllers.jobs.get);
  app.get('/api/profiles/v2/search/jobs.json', controllers.jobs.list);
  app.get('/api/profiles/v2/metadata/categories.json', controllers.jobs.categoriesList);

  // swagger editor
  app.use('/docs', express.static(__dirname + '/../public/swagger'));
  app.use('/api.yaml', express.static(__dirname + '/../api.yaml'));
  app.use('/docs/editor', express.static(__dirname + '/../public/swagger-editor'));
  app.use('/docs/editor/specs', express.static(__dirname + '/../api.yaml'));
  app.put('/docs/editor/specs', controllers.utils.storeApi);

  // main page
  // app.use(express.static(__dirname + '/../public/homepage'));
  app.get('/', function(req, res) {
    res.sendFile(path.resolve(__dirname + '/../public/homepage/index.html'));
  });
  app.use('/privacy-policy', express.static(__dirname + '/../public/privacy-policy'));
  app.use('/images', express.static(__dirname + '/../public/homepage/images'));
  app.use('/i', express.static(__dirname + '/../public/homepage/i'));

  app.post('/ip', controllers.ip.save);
};
