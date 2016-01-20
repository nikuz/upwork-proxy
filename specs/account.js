'use strict';

var _ = require('underscore'),
  async = require('async'),
  expect = require('chai').expect,
  fixtures = require('./fixtures/fixtures'),
  data = require('./fixtures/data/index'),
  addUser1 = data.addUser1,
  addUser2 = data.addUser2,
  updateNotificationsIntervalUser1 = data.updateNotificationsIntervalUser1,
  events = require('../app/modules/events'),
  account = require('../app/models/account');

describe('Account', function() {
  describe('Create', function() {
    var user2id;
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addUser2], function(err, response) {
        expect(!!err).to.eql(false);
        user2id = response[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should allow to create new users', function(done) {
      account.create(addUser1.params, function(err, response) {
        expect(!!err).to.eql(false);
        expect(response).to.be.an('object');
        expect(response.userid).to.be.an('string');
        expect(response.userid).to.have.length.above(0);
        done();
      });
    });
    it('should return id of user if it already exist', function(done) {
      account.create(addUser2.params, function(err, response) {
        expect(!!err).to.eql(false);
        expect(response).to.be.an('object');
        expect(response.userid).to.eql(user2id);
        done();
      });
    });
    it('should return error if some required field is not defined', function(done) {
      account.create({}, function(err) {
        expect(!!err).to.eql(true);
        done();
      });
    });
  });

  describe('Get', function() {
    var user1id;
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addUser1], function(err, response) {
        user1id = response[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should return account of specific user', function(done) {
      account.get({
        userid: user1id
      }, function(err, response) {
        expect(!!err).to.eql(false);
        expect(response).to.be.an('object');
        expect(response.id).to.eql(user1id);
        expect(response.push_id).to.eql(addUser1.params.id);
        _.each(response, function(value, key) {
          if (key !== 'id' && !_.isUndefined(addUser1.params[key])) {
            expect(value).to.eql(addUser1.params[key]);
          }
        });
        done();
      });
    });
    it('should return error if user is not exists', function(done) {
      account.get({
        userid: 'not_exists_user'
      }, function(err) {
        expect(!!err).to.eql(true);
        done();
      });
    });
  });

  describe('Login', function() {
    var user1id;
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addUser1], function(err, response) {
        user1id = response[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should allow to login by specific user', function(done) {
      async.series([
        function(callback) {
          account.login({
            userid: user1id
          }, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          account.get({
            userid: user1id
          }, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.last_logon).to.not.be.an('undefined');
            callback();
          });
        }
      ], done);
    });
    it('should return error if user is not exists', function(done) {
      account.login({
        userid: 'not_exists_user'
      }, function(err) {
        expect(!!err).to.eql(true);
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
        user1id = response[0] && response[0].userid;
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
          params.userid = user1id;
          account.update(params, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          account.get({
            userid: user1id
          }, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.id).to.eql(user1id);
            _.each(response, function(value, key) {
              if (key !== 'id' && key !== 'os' && !_.isUndefined(addUser2.params[key])) {
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
    it('should return error if try to update account of not existing user', function(done) {
      var params = _.clone(addUser2.params);
      params.userid = 'not_exists_user';
      account.update(params, function(err) {
        expect(!!err).to.eql(true);
        done();
      });
    });
    it('should return error if not specified no one field for update', function(done) {
      account.update({
        userid: user1id
      }, function(err) {
        expect(!!err).to.eql(true);
        done();
      });
    });
  });

  describe('Stats', function() {
    var user1id;
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addUser1], function(err, response) {
        user1id = response[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should return statistic for specifis user', function(done) {
      account.stats({
        userid: user1id
      }, function(err, response) {
        expect(!!err).to.eql(false);
        expect(response).to.be.an('object');
        expect(response.notificationsMinutes).to.be.an('array');
        _.each(response, function(value, key) {
          if (key !== 'id' && !_.isUndefined(addUser1.params[key])) {
            expect(value).to.eql(addUser1.params[key]);
          }
        });
        done();
      });
    });
  });

  describe('Update notification interval', function() {
    var user1id;
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addUser1], function(err, response) {
        user1id = response[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should update users notification interval', function(done) {
      var updateParams = {
        userid: user1id,
        timezone: -480,
        interval: 10
      };
      async.series([
        function(callback) {
          account.updateNotificationsInterval(updateParams, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          account.stats({
            userid: user1id
          }, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.id).to.eql(user1id);
            var minutes = response.notificationsMinutes;
            expect(minutes).to.be.an('array');
            expect(minutes).to.have.length.above(0);
            _.each(minutes, function(item) {
              item = item.split(':');
              expect(item[1] % updateParams.interval).to.eql(0);
            });
            callback();
          });
        }
      ], function() {
        done();
      });
    });
    it('should update users notification DND interval', function(done) {
      var updateParams = {
        userid: user1id,
        timezone: -480,
        interval: 5,
        dndFrom: '23:00',
        dndTo: '07:00'
      };
      async.series([
        function(callback) {
          account.updateNotificationsInterval(updateParams, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          account.stats({
            userid: user1id
          }, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.id).to.eql(user1id);
            var minutes = response.notificationsMinutes;
            expect(minutes).to.be.an('array');
            expect(minutes).to.have.length.above(0);
            _.each(minutes, function(item) {
              item = item.split(':');
              expect(item[1] % updateParams.interval).to.eql(0);
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
      var updateParams = {
        userid: user1id,
        timezone: 240,
        prevTimezone: -480,
        interval: 5,
        dndFrom: '00:00',
        dndTo: '06:00'
      };
      async.series([
        function(callback) {
          var data = _.extend(_.clone(addUser1.params), updateParams);
          account.update(data, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          account.updateNotificationsInterval(updateParams, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          account.stats({
            userid: user1id
          }, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.id).to.eql(user1id);
            var minutes = response.notificationsMinutes;
            expect(minutes).to.be.an('array');
            expect(minutes).to.have.length.above(0);
            _.each(minutes, function(item) {
              item = item.split(':');
              item[1] = Number(item[1]);
              expect(item[0]).to.eql(String(updateParams.timezone));
              expect(item[1] % updateParams.interval).to.eql(0);
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
          var updateParams = {
            userid: user1id,
            timezone: -480
          };
          account.updateNotificationsInterval(updateParams, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          account.stats({
            userid: user1id
          }, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.id).to.eql(user1id);
            var minutes = response.notificationsMinutes;
            expect(minutes).to.be.an('array');
            expect(minutes).to.have.length(0);
            callback();
          });
        }
      ], function() {
        done();
      });
    });
    it('should return error if users time zone is not defined or not exists', function(done) {
      account.updateNotificationsInterval({
        userid: user1id,
        interval: 5,
        timezone: 1312123
      }, function(err) {
        expect(!!err).to.eql(true);
        done();
      });
    });
  });

  describe('Disable notifications', function() {
    var userInfo;
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addUser1, updateNotificationsIntervalUser1], function(err, response) {
        userInfo = response[0];
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should disable notification to specific user', function(done) {
      async.series([
        function(callback) {
          account.stats({
            userid: userInfo.userid
          }, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.id).to.eql(userInfo.userid);
            var minutes = response.notificationsMinutes;
            expect(minutes).to.be.an('array');
            expect(minutes).to.have.length.above(0);
            callback();
          });
        },
        function(callback) {
          account.disableNotifications({
            userid: userInfo.userid
          }, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          account.stats({
            userid: userInfo.userid
          }, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.an('object');
            expect(response.id).to.eql(userInfo.userid);
            var minutes = response.notificationsMinutes;
            expect(minutes).to.be.an('array');
            expect(minutes).to.have.length(0);
            callback();
          });
        }
      ], function() {
        done();
      });
    });
  });
});
