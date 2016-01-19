'use strict';

var _ = require('underscore'),
  async = require('async'),
  expect = require('chai').expect,
  jobs = require('../api/modules/jobs');

describe('Jobs', function() {
  describe('Get', function() {
    it('should return info of specific job by id', function(done) {
      var jobId = '~010e6fbc3fb9ec7573';
      jobs.get({
        id: jobId
      }, function(err, response) {
        expect(!!err).to.eql(false);
        response = JSON.parse(response);
        expect(response.auth_user).to.be.an('object');
        expect(response.profile).to.be.an('object');
        expect(response.profile.ciphertext).to.eql(jobId);
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

  describe('List', function() {
    it('should return list of jobs', function(done) {
      jobs.list({
        q: 'java',
        paging: '0;5'
      }, function(err, response) {
        expect(!!err).to.eql(false);
        response = JSON.parse(response);
        expect(response.jobs).to.be.an('array');
        expect(response.jobs.length).to.eql(5);
        done();
      });
    });
    it('should return list of jobs which contain "java" word in his title', function(done) {
      jobs.list({
        title: 'java',
        paging: '0;5'
      }, function(err, response) {
        expect(!!err).to.eql(false);
        response = JSON.parse(response);
        expect(response.jobs).to.be.an('array');
        expect(response.jobs.length).to.eql(5);
        _.each(response.jobs, function(item) {
          expect(/java/i.test(item.title)).to.eql(true);
        });
        done();
      });
    });
    it('should return list of jobs which contain "java" word in his skills', function(done) {
      jobs.list({
        skills: 'java',
        paging: '0;5'
      }, function(err, response) {
        expect(!!err).to.eql(false);
        response = JSON.parse(response);
        expect(response.jobs).to.be.an('array');
        expect(response.jobs.length).to.eql(5);
        _.each(response.jobs, function(item) {
          var javaContains = false;
          _.every(item.skills, function(skillItem) {
            if (/java/i.test(skillItem)) {
              javaContains = true;
              return false;
            } else {
              return true;
            }
          });
          expect(javaContains).to.eql(true);
        });
        done();
      });
    });
    it('should return list of jobs from specific category', function(done) {
      var category = 'Web, Mobile & Software Dev';
      jobs.list({
        q: 'java',
        paging: '0;5',
        category2: category
      }, function(err, response) {
        expect(!!err).to.eql(false);
        response = JSON.parse(response);
        expect(response.jobs).to.be.an('array');
        expect(response.jobs.length).to.eql(5);
        _.each(response.jobs, function(item) {
          expect(item.category2).to.eql(category);
        });
        done();
      });
    });
    it('should return list of specific duration jobs', function(done) {
      var durations = [
        { Month: 'Less than 1 month' },
        { Week: 'Less than 1 week' },
        { Quarter: '1 to 3 months' },
        { Semester: '3 to 6 months' },
        { Ongoing: 'More than 6 months' }
      ];
      async.each(durations, function(duration, internalCallback) {
        jobs.list({
          q: 'java',
          paging: '0;100',
          duration: _.keys(duration)[0].toLowerCase()
        }, function(err, response) {
          expect(!!err).to.eql(false);
          response = JSON.parse(response);
          expect(response.jobs).to.be.an('array');
          expect(response.jobs.length).to.eql(100);
          _.each(response.jobs, function(item) {
            if (item.duration !== null) { // some jobs has't duration param
              expect(item.duration).to.eql(_.values(duration)[0]);
            }
          });
          internalCallback();
        });
      }, function() {
        done();
      });
    });
    it('should return list of specific job type jobs', function(done) {
      var jobTypes = [
        { Hourly: 'Hourly' },
        { Fixed: 'Fixed' }
      ];
      async.each(jobTypes, function(type, internalCallback) {
        jobs.list({
          q: 'java',
          paging: '0;100',
          job_type: _.keys(type)[0].toLowerCase()
        }, function(err, response) {
          expect(!!err).to.eql(false);
          response = JSON.parse(response);
          expect(response.jobs).to.be.an('array');
          expect(response.jobs.length).to.eql(100);
          _.each(response.jobs, function(item) {
            if (item.job_type !== null) { // some jobs has't job_type param
              expect(item.job_type).to.eql(_.values(type)[0]);
            }
          });
          internalCallback();
        });
      }, function() {
        done();
      });
    });
    it('should return list of specific workload type jobs', function(done) {
      var workloads = [
        {
          as_needed: [
            '30+ hrs/week',
            'Less than 10 hrs/week'
          ]
        },
        {
          part_time: [
            '30+ hrs/week',
            '10-30 hrs/week'
          ]
        },
        {
          full_time: [
            '30+ hrs/week'
          ]
        }
      ];
      async.each(workloads, function(workload, internalCallback) {
        jobs.list({
          q: 'java',
          paging: '0;100',
          workload: _.keys(workload)[0].toLowerCase()
        }, function(err, response) {
          expect(!!err).to.eql(false);
          response = JSON.parse(response);
          expect(response.jobs).to.be.an('array');
          expect(response.jobs.length).to.eql(100);
          _.each(response.jobs, function(item) {
            if (item.workload !== null) { // some jobs has't workload param
              expect(_.values(workload)[0]).to.include(item.workload);
            }
          });
          internalCallback();
        });
      }, function() {
        done();
      });
    });
    it('should return list of jobs sorted descending', function(done) {
      jobs.list({
        q: 'java',
        paging: '0;20',
        sort: 'create_time desc'
      }, function(err, response) {
        expect(!!err).to.eql(false);
        response = JSON.parse(response);
        expect(response.jobs).to.be.an('array');
        expect(response.jobs.length).to.eql(20);
        var prevJobCreatedTime = response.jobs[0].date_created;
        _.each(response.jobs, function(item) {
          expect(prevJobCreatedTime).to.be.least(item.date_created);
          prevJobCreatedTime = item.date_created;
        });
        done();
      });
    });
    // unreliable, upwork can return jobs outside the budget interval
    //it('should return list of jobs from specific budget interval', function(done) {
    //  jobs.list({
    //    q: 'javascript',
    //    paging: '0;20',
    //    budget: '[100 TO 200]'
    //  }, function(err, response) {
    //    expect(!!err).to.eql(false);
    //    response = JSON.parse(response);
    //    expect(response.jobs).to.be.an('array');
    //    expect(response.jobs.length).to.eql(20);
    //    _.each(response.jobs, function(item) {
    //      if (item.budget !== null) { // some jobs has't budget param
    //        expect(item.budget).to.be.least(100);
    //        expect(item.budget).to.be.most(200);
    //      }
    //    });
    //    done();
    //  });
    //});
  });

  describe('Get categories', function() {
    it('should return list of available categories', function(done) {
      jobs.categoriesList({}, function(err, response) {
        expect(!!err).to.eql(false);
        response = JSON.parse(response);
        expect(response.categories).to.be.an('array');
        expect(response.categories).to.have.length.above(0);
        done();
      });
    });
  });
});
