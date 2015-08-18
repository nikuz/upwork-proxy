'use strict';

var _ = require('underscore'),
  async = require('async'),
  expect = require('chai').expect,
  fixtures = require('./data/fixtures'),
  data = require('./data/index'),
  addUser1 = data.addUser1,
  addUser2 = data.addUser2,
  fillMinutesUser1 = data.fillMinutesUser1,
  events = require('../api/modules/events'),
  account = require('../api/modules/account'),
  request = require('../api/request'),
  baseUrl = 'http://localhost:8020';

describe('Account', function() {
  describe('Create', function() {
    var user2id;
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addUser2], function(err, response) {
        var results = response.results;
        user2id = results[0] && results[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should allow to create new users', function(done) {
      request.post(baseUrl + '/account', addUser1.params, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(false);
        expect(response.userid).to.be.an('string');
        expect(response.userid).to.have.length.above(0);
        done();
      });
    });
    it('should return id of user if it already exist', function(done) {
      request.post(baseUrl + '/account', addUser2.params, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(false);
        expect(response.userid).to.eql(user2id);
        done();
      });
    });
    it('should return error if some required field is not defined', function(done) {
      var data = _.clone(addUser1.params);
      delete data.id;
      request.post(baseUrl + '/account', data, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(true);
        done();
      });
    });
  });

  describe('Get', function() {
    var user1id,
      interval = 5;

    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addUser1, fillMinutesUser1], function(err, response) {
        var results = response.results;
        user1id = results[0] && results[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should return account of specific user', function(done) {
      request.get(baseUrl + '/accounts/' + user1id, null, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(false);
        expect(response.id).to.eql(user1id);
        expect(response.push_id).to.eql(addUser1.params.id);
        _.each(response, function(value, key) {
          if (key !== 'id' && !_.isUndefined(addUser1.params[key])) {
            expect(value).to.eql(addUser1.params[key]);
          }
        });
        var minutes = response.notificationsMinutes;
        expect(minutes).to.be.an('array');
        expect(minutes).to.have.length.above(0);
        _.each(minutes, function(item) {
          item = item.split(':');
          item[1] = Number(item[1]);
          expect(item[0]).to.eql(String(addUser1.params.timezone));
          expect(item[1] % interval).to.eql(0);
          expect(item[1]).to.be.above(0);
          expect(item[1]).to.be.below(1440);
        });
        done();
      });
      account.get({
        id: user1id
      }, function(err, response) {

      });
    });
    it('should return error if user is not exists', function(done) {
      request.get(baseUrl + '/accounts/not_exists_user', null, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(true);
        done();
      });
    });
  });

  describe('Update', function() {
    var user1id;
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addUser1], function(err, response) {
        var results = response.results;
        user1id = results[0] && results[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should update account of specific user', function(done) {
      async.series([
        function(callback) {
          var params = _.clone(addUser2.params);
          request.put(baseUrl + '/account/' + user1id, params, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          request.get(baseUrl + '/accounts/' + user1id, null, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.id).to.eql(user1id);
            _.each(response, function(value, key) {
              if (key !== 'id' && !_.isUndefined(addUser2.params[key])) {
                expect(value).to.eql(addUser2.params[key]);
              }
            });
            callback();
          });
        }
      ], function() {
        done();
      });
    });

    it('should return error if try to update not exists user', function(done) {
      var params = _.clone(addUser2.params);
      request.put(baseUrl + '/account/not_exists_user', params, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(true);
        done();
      });
    });
  });

  describe('Update notification settings', function() {
    var user1id;
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addUser1, fillMinutesUser1], function(err, response) {
        var results = response.results;
        user1id = results[0] && results[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should update users notification interval', function(done) {
      var updateParams = _.clone(addUser1.params);
      _.extend(updateParams, {
        feeds: 'java',
        notifyInterval: 10
      });
      async.series([
        function(callback) {
          request.put(baseUrl + '/account/' + user1id, updateParams, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          request.get(baseUrl + '/accounts/' + user1id, null, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.id).to.eql(user1id);
            var minutes = response.notificationsMinutes;
            expect(minutes).to.be.an('array');
            expect(minutes).to.have.length.above(0);
            _.each(minutes, function(item) {
              item = item.split(':');
              expect(item[1] % updateParams.notifyInterval).to.eql(0);
            });
            callback();
          });
        }
      ], function() {
        done();
      });
    });
    it('should update users notification DND interval', function(done) {
      var updateParams = _.clone(addUser1.params);
      _.extend(updateParams, {
        feeds: 'java',
        dndFrom: '23:00',
        dndTo: '07:00'
      });
      async.series([
        function(callback) {
          request.put(baseUrl + '/account/' + user1id, updateParams, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          request.get(baseUrl + '/accounts/' + user1id, null, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.id).to.eql(user1id);
            var minutes = response.notificationsMinutes;
            expect(minutes).to.be.an('array');
            expect(minutes).to.have.length.above(0);
            _.each(minutes, function(item) {
              item = item.split(':');
              expect(item[1] % addUser1.params.notifyInterval).to.eql(0);
              expect(item[1]).to.be.least(420);
              expect(item[1]).to.be.most(1380);
            });
            callback();
          });
        }
      ], function() {
        done();
      });
    });
    it('should update users notification time zone', function(done) {
      var updateParams = _.clone(addUser1.params);
      _.extend(updateParams, {
        feeds: 'java',
        timezone: 240
      });
      async.series([
        function(callback) {
          request.put(baseUrl + '/account/' + user1id, updateParams, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          request.get(baseUrl + '/accounts/' + user1id, null, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.id).to.eql(user1id);
            var minutes = response.notificationsMinutes;
            expect(minutes).to.be.an('array');
            expect(minutes).to.have.length.above(0);
            _.each(minutes, function(item) {
              item = item.split(':');
              item[1] = Number(item[1]);
              expect(item[0]).to.eql(String(updateParams.timezone));
              expect(item[1] % addUser1.params.notifyInterval).to.eql(0);
              expect(item[1]).to.be.least(360);
              expect(item[1]).to.be.below(1440);
            });
            callback();
          });
        }
      ], function() {
        done();
      });
    });
    it('should disable notification to specific user', function(done) {
      async.series([
        function(callback) {
          // add feeds
          var updateParams = _.clone(addUser1.params);
          _.extend(updateParams, {
            feeds: 'java'
          });
          request.put(baseUrl + '/account/' + user1id, updateParams, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          // disable notifications
          var updateParams = _.clone(addUser1.params);
          _.extend(updateParams, {
            notifyAllow: false
          });
          request.put(baseUrl + '/account/' + user1id, updateParams, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          request.get(baseUrl + '/accounts/' + user1id, null, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.id).to.eql(user1id);
            var minutes = response.notificationsMinutes;
            expect(minutes).to.be.an('array');
            expect(minutes.length).to.eql(0);
            callback();
          });
        }
      ], function() {
        done();
      });
    });
  });

  describe('Force convert numeric and boolean fields', function() {
    var user1id;
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addUser1], function(err, response) {
        var results = response.results;
        user1id = results[0] && results[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('when creating an account', function(done) {
      var userid;
      async.series([
        function(callback) {
          var data = _.clone(addUser2.params);
          data.budgetFrom = '100';
          data.notifyAllow = 'true';
          request.post(baseUrl + '/account', data, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            userid = response.userid;
            callback();
          });
        },
        function(callback) {
          request.get(baseUrl + '/accounts/' + userid, null, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.budgetFrom).to.eql(100);
            expect(response.notifyAllow).to.eql(true);
            callback();
          });
        }
      ], function() {
        done();
      });
    });
    it('when updating an account', function(done) {
      async.series([
        function(callback) {
          var data = _.clone(addUser2.params);
          data.budgetFrom = '100';
          data.notifyAllow = 'true';
          request.put(baseUrl + '/account/' + user1id, data, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          request.get(baseUrl + '/accounts/' + user1id, null, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.budgetFrom).to.eql(100);
            expect(response.notifyAllow).to.eql(true);
            callback();
          });
        }
      ], function() {
        done();
      });
    });
  });

  describe('Url encoded body', function() {
    var user1id;
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addUser1], function(err, response) {
        var results = response.results;
        user1id = results[0] && results[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should create an account even data sent as urlencoded string', function(done) {
      var data = _.clone(addUser2.params);
      data['x-urlencoded'] = true;
      request.post(baseUrl + '/account', data, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(false);
        expect(response.userid).to.be.an('string');
        expect(response.userid).to.have.length.above(0);
        done();
      });
    });
    it('should update an account even data sent as urlencoded string', function(done) {
      var data = _.clone(addUser2.params);
      data['x-urlencoded'] = true;
      request.put(baseUrl + '/account/' + user1id, data, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(false);
        expect(response.success).to.eql(true);
        done();
      });
    });
  });
});
