'use strict';

var _ = require('underscore'),
  async = require('async'),
  expect = require('chai').expect,
  data = require('./data/index'),
  jobsToFilter = data.jobsToFilter,
  notifier = require('../notifier');

describe('Notifier', function() {
  describe('Start', function() {
    it('should return seconds to closest minute that will divide to 5', function(done) {
      var now = Date.now(),
        minutes = [now],
        i = 1, l = 1440;

      for (; i < l; i += 1) {
        minutes.push(now + i * 1000 * 60);
      }
      async.each(minutes, function(minute, callback) {
        notifier.start({
          test: true,
          minute: minute
        }, function(err, response) {
          expect(!!err).to.eql(false);
          expect(response).to.be.an('object');
          var targetMinute = new Date(minute + response.startAfter).getUTCMinutes();
          expect(targetMinute % 5).to.eql(0);
          callback();
        });
      }, function() {
        done();
      });
    });
  });

  describe('Calculate timezone minutes', function() {
    it('should return array of minutes of all time zones based on current minute', function(done) {
      var minutesPerDay = 1440,
        now = Date.now(),
        minutes = [now],
        i = 1;

      for (; i < minutesPerDay; i += 1) {
        minutes.push(now + i * 1000 * 60);
      }
      async.each(minutes, function(minute, callback) {
        notifier.calculateMinutes({
          minute: minute
        }, function(err, response) {
          expect(!!err).to.eql(false);
          expect(response).to.be.an('object');
          var minutes = response.minutes,
            firstTimeZone,
            firstMinute;
          _.each(minutes, function(item) {
            item = item.split(':');
            var timezone = Number(item[1]),
              minute = Number(item[2]);
            if (!firstMinute) {
              firstTimeZone = timezone;
              firstMinute = minute;
            } else {
              var calculatedMinute = firstMinute + firstTimeZone - timezone;
              if (calculatedMinute > minutesPerDay) {
                while (calculatedMinute > minutesPerDay) {
                  calculatedMinute = Math.abs(minutesPerDay - calculatedMinute);
                }
                if (calculatedMinute === minutesPerDay) {
                  calculatedMinute = 0;
                }
                expect(minute).to.eql(calculatedMinute);
              } else if (calculatedMinute === minutesPerDay) {
                expect(minute).to.eql(0);
              } else {
                expect(minute).to.eql(calculatedMinute);
              }
            }
          });
          callback();
        });
      }, function() {
        done();
      });
    });
  });

  //describe('Filter', function() {
  //  it('should return only jobs with duration equal "Less than 1 month"', function(done) {
  //    notifier.filter(jobsToFilter, function(err, response) {
  //      console.log(response);
  //      expect(!!err).to.eql(false);
  //      expect(response).to.be.an('object');
  //      done();
  //    });
  //  });
  //});
});
