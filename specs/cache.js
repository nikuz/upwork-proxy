'use strict';

var expect = require('chai').expect,
  async = require('async'),
  fixtures = require('./fixtures/fixtures'),
  data = require('./fixtures/data/index'),
  addCache = data.addCache,
  events = require('../app/modules/events'),
  cache = require('../app/models/cache');

describe('Cache', function() {
  describe('Get id', function() {
    var idReg = /^[a-z0-9]+$/;
    it('should return hashed id based on received data', function() {
      var id = cache.getId({
        field1: 'field 1',
        field2: 'field 2'
      });
      expect(id).to.be.a('string');
      expect(id).match(idReg);
    });
    it('should return error if data did not specified', function() {
      var id = cache.getId({});
      expect(id).not.match(idReg);
      var id2 = cache.getId();
      expect(id2).not.match(idReg);
    });
    it('should return different ids for different data sets', function() {
      var id = cache.getId({
        field1: 'field 1',
        field2: 'field 2'
      });
      expect(id).match(idReg);
      var id2 = cache.getId({
        new_field: 'field 1',
        old_field: 'field 2'
      });
      expect(id2).match(idReg);
      expect(id).to.not.eql(id2);
    });
  });

  describe('Store', function() {
    beforeEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should allow to store data to cache', function(done) {
      cache.store({
        id: 'cache_id',
        data: 'data'
      }, function(err, response) {
        expect(!!err).to.eql(false);
        expect(response).to.be.an('object');
        expect(response.success).to.eql(true);
        done();
      });
    });
    it('should return error if `id` did not specified', function(done) {
      cache.store({
        data: 'data'
      }, function(err) {
        expect(!!err).to.eql(true);
        done();
      });
    });
    it('should return error if `data` did not specified', function(done) {
      cache.store({
        id: 'cache_id'
      }, function(err) {
        expect(!!err).to.eql(true);
        done();
      });
    });
  });

  describe('Get', function() {
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addCache], done);
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('should return cache by id', function(done) {
      cache.get({
        id: addCache.params.id
      }, function(err, response) {
        expect(!!err).to.eql(false);
        expect(response).to.be.a('string');
        expect(response).to.eql(addCache.params.data);
        done();
      });
    });
    it('should return error if `id` did not specified', function(done) {
      cache.get({}, function(err) {
        expect(!!err).to.eql(true);
        done();
      });
    });
  });

  describe('Expiration', function() {
    before(function(done) {
      fixtures.cleanup(done);
    });

    beforeEach(function(done) {
      events.replay([addCache], done);
    });

    afterEach(function(done) {
      fixtures.cleanup(done);
    });

    it('cache should be removed after 3 seconds', function(done) { // actually after 5 minutes for production
      async.series([
        function(callback) {
          cache.get({
            id: addCache.params.id
          }, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.be.a('string');
            expect(response).to.eql(addCache.params.data);
            callback();
          });
        },
        function(callback) {
          setTimeout(callback, 1000 * 4);
        },
        function(callback) {
          cache.get({
            id: addCache.params.id
          }, function(err, response) {
            expect(!!err).to.eql(false);
            expect(response).to.eql(null);
            callback();
          });
        }
      ], done);
    });
  });
});
