'use strict';

var _ = require('underscore'),
  async = require('async'),
  expect = require('chai').expect,
  fixtures = require('./fixtures/fixtures'),
  data = require('./fixtures/data/index'),
  addUser1 = data.addUser1,
  addUser2 = data.addUser2,
  events = require('../app/modules/events'),
  request = require('../app/request'),
  baseUrl = 'http://localhost:8020';

describe('Account', function() {
  describe('Create', function() {
    var user2id;
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addUser2], function(err, response) {
        var results = response;
        user2id = results[0] && results[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should allow to create new users', function(done) {
      request.post(`${baseUrl}/accounts`, addUser1.params, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(false);
        expect(response.userid).to.be.an('string');
        expect(response.userid).to.have.length.above(0);
        done();
      });
    });
    it('should return id of user if it already exist', function(done) {
      request.post(`${baseUrl}/accounts`, addUser2.params, function(err, response) {
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
      request.post(`${baseUrl}/accounts`, data, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(true);
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
        user1id = response[0] && response[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should return account of specific user', function(done) {
      request.get(`${baseUrl}/accounts/${user1id}`, null, function(err, response) {
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
        done();
      });
    });
    it('should return error if user is not exists', function(done) {
      request.get(`${baseUrl}/accounts/not_exists_user`, null, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(true);
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
        user1id = response[0] && response[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should allow to login by specific user', function(done) {
      async.series([
        function(callback) {
          var data = {
            timezone: addUser1.params.timezone
          };
          request.put(`${baseUrl}/accounts/${user1id}/login`, data, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          request.get(`${baseUrl}/accounts/${user1id}`, null, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.last_logon).to.not.be.an('undefined');
            callback();
          });
        }
      ], done);
    });
    it('should update users notification interval if timezone was changed', function(done) {
      var newTimeZone = 240;
      async.series([
        function(callback) {
          // add feeds
          var data = _.extend(_.clone(addUser1.params), {
            feeds: 'java'
          });
          request.put(`${baseUrl}/accounts/${user1id}/feeds`, data, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          var data = {
            timezone: newTimeZone
          };
          request.put(`${baseUrl}/accounts/${user1id}/login`, data, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          request.get(`${baseUrl}/accounts/${user1id}/stats`, null, function(err, response) {
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
              expect(item[0]).to.eql(String(newTimeZone));
              expect(item[1] % addUser1.params.notifyInterval).to.eql(0);
            });
            callback();
          });
        }
      ], function() {
        done();
      });
    });
    it('should return error if user is not exists', function(done) {
      request.put(`${baseUrl}/accounts/not_exists_user/login`, null, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(true);
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
      request.get(`${baseUrl}/accounts/${user1id}/stats`, null, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(false);
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

  describe('Add Upwork token', function() {
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

    it('should add token for access to Upwork.com to specific user', function(done) {
      var params = {
        token: 'some_token',
        token_secret: 'some_token_secret'
      };
      request.put(`${baseUrl}/accounts/${user1id}/token`, params, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(false);
        expect(response.success).to.eql(true);
        done();
      });
    });
    it('should return error if `token` field is not defined', function(done) {
      var params = {
        token_secret: 'some_token_secret'
      };
      request.put(`${baseUrl}/accounts/${user1id}/token`, params, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(true);
        done();
      });
    });
    it('should return error if `token_secret` field is not defined', function(done) {
      var params = {
        token: 'some_token'
      };
      request.put(`${baseUrl}/accounts/${user1id}/token`, params, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(true);
        done();
      });
    });
  });

  describe('Add feeds', function() {
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

    it('should add feeds to specific user', function(done) {
      var params = {
        feeds: 'java'
      };
      request.put(`${baseUrl}/accounts/${user1id}/feeds`, params, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(false);
        expect(response.success).to.eql(true);
        done();
      });
    });
    it('should set initial notification interval if it is first added feeds', function(done) {
      async.series([
        function(callback) {
          var params = {
            feeds: 'java'
          };
          request.put(`${baseUrl}/accounts/${user1id}/feeds`, params, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          request.get(baseUrl + '/accounts/' + user1id + '/stats', null, function(err, response) {
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
            });
            callback();
          });
        }
      ], done);
    });
    it('should return error if `feeds` field is not defined', function(done) {
      request.put(`${baseUrl}/accounts/${user1id}/feeds`, {}, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(true);
        done();
      });
    });
  });

  describe('Update settings', function() {
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

    it('should update users notification interval', function(done) {
      var newNotifyInterval = 10;
      async.series([
        function(callback) {
          // add feeds
          var data = _.extend(_.clone(addUser1.params), {
            feeds: 'java'
          });
          request.put(`${baseUrl}/accounts/${user1id}/feeds`, data, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          var data = _.extend(_.clone(addUser1.params), {
            notifyInterval: newNotifyInterval
          });
          request.put(`${baseUrl}/accounts/${user1id}/settings`, data, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          request.get(`${baseUrl}/accounts/${user1id}/stats`, null, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.id).to.eql(user1id);
            var minutes = response.notificationsMinutes;
            expect(minutes).to.be.an('array');
            expect(minutes).to.have.length.above(0);
            _.each(minutes, function(item) {
              item = item.split(':');
              expect(item[1] % newNotifyInterval).to.eql(0);
            });
            callback();
          });
        }
      ], function() {
        done();
      });
    });
    it('should update users notification DND interval', function(done) {
      async.series([
        function(callback) {
          // add feeds
          var data = _.extend(_.clone(addUser1.params), {
            feeds: 'java'
          });
          request.put(`${baseUrl}/accounts/${user1id}/feeds`, data, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          var data = _.extend(_.clone(addUser1.params), {
            dndFrom: '23:00',
            dndTo: '07:00'
          });
          request.put(`${baseUrl}/accounts/${user1id}/settings`, data, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          request.get(`${baseUrl}/accounts/${user1id}/stats`, null, function(err, response) {
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
    it('should disable notification to specific user', function(done) {
      async.series([
        function(callback) {
          // add feeds
          var data = _.extend(_.clone(addUser1.params), {
            feeds: 'java'
          });
          request.put(`${baseUrl}/accounts/${user1id}/feeds`, data, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          // disable notifications
          var data = _.extend(_.clone(addUser1.params), {
            notifyAllow: false
          });
          request.put(`${baseUrl}/accounts/${user1id}/settings`, data, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.success).to.eql(true);
            callback();
          });
        },
        function(callback) {
          request.get(`${baseUrl}/accounts/${user1id}/stats`, null, function(err, response) {
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

  describe('Update last job date', function() {
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
    it('should update date of last job that user got', function(done) {
      var newLastJobDate = new Date().toISOString();
      async.series([function(callback) {
        var data = {
          date: newLastJobDate
        };
        request.put(`${baseUrl}/accounts/${user1id}/last_job_date`, data, function(err, response) {
          expect(err).to.eql(null);
          expect(response).to.be.an('object');
          expect(!!response.error).to.eql(false);
          expect(response.success).to.eql(true);
          callback();
        });
      }, function(callback) {
        request.get(`${baseUrl}/accounts/${user1id}/stats`, null, function(err, response) {
          expect(err).to.eql(null);
          expect(response).to.be.an('object');
          expect(!!response.error).to.eql(false);
          expect(response.id).to.eql(user1id);
          expect(response.last_job_date).to.eql(newLastJobDate);
          callback();
        });
      }], function() {
        done();
      });
    });
    it('should return error if received date can be converted to Date object', function(done) {
      var data = {
        date: 'test date'
      };
      request.put(`${baseUrl}/accounts/${user1id}/last_job_date`, data, function(err, response) {
        expect(err).to.eql(null);
        expect(response).to.be.an('object');
        expect(!!response.error).to.eql(true);
        done();
      });
    });
  });

  // update the last_login and the time zone for already registered users
  // by second and others registration requests
  describe('Update by create', function() {
    var user1id;
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addUser1], function(err, response) {
        var results = response;
        user1id = results[0] && results[0].userid;
        done();
      });
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should update last_login field for already registered user', function(done) {
      async.series([
        function(callback) {
          setTimeout(function() {
            callback();
          }, 1000);
        },
        function(callback) {
          request.post(`${baseUrl}/accounts`, addUser1.params, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.userid).to.eql(user1id);
            callback();
          });
        },
        function(callback) {
          request.get(`${baseUrl}/accounts/${user1id}`, null, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.id).to.eql(user1id);
            expect(Date.now() - new Date(response.last_logon).getTime()).to.be.below(100);
            callback();
          });
        }
      ], done);
    });

    it('should update timezone and DND interval if new timezone received for already registered user', function(done) {
      var newTimeZone = addUser2.params.timezone;
      async.series([
        function(callback) {
          var data = _.clone(addUser1.params);
          data.timezone = newTimeZone;
          request.post(`${baseUrl}/accounts`, data, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.userid).to.eql(user1id);
            callback();
          });
        },
        function(callback) {
          request.get(`${baseUrl}/accounts/${user1id}/stats`, null, function(err, response) {
            expect(err).to.eql(null);
            expect(response).to.be.an('object');
            expect(!!response.error).to.eql(false);
            expect(response.id).to.eql(user1id);
            expect(response.timezone).to.eql(newTimeZone);
            var minutes = response.notificationsMinutes;
            expect(minutes).to.be.an('array');
            expect(minutes).to.have.length.above(0);
            _.each(minutes, function(item) {
              item = item.split(':');
              item[1] = Number(item[1]);
              expect(item[0]).to.eql(String(newTimeZone));
              expect(item[1] % addUser1.params.notifyInterval).to.eql(0);
            });
            callback();
          });
        }
      ], done);
    });
  });
});
