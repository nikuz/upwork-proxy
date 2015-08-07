'use strict';

var expect = require('chai').expect,
  jobs = require('../modules/jobs');

describe('Jobs', function() {
  describe('Get', function() {
    it('should return info of specific job by id', function(done) {
      jobs.get({
        id: '~010e6fbc3fb9ec7573'
      }, function(err, response) {
        expect(!!err).to.eql(false);
        response = JSON.parse(response);
        expect(response.auth_user).to.be.an('object');
        expect(response.profile).to.be.an('object');
        done();
      });
    });
    it('should return error if job id is not defined', function(done) {
      jobs.get({}, function(err) {
        expect(!!err).to.eql(true);
        done();
      });
    });
  });
});
