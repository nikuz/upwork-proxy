'use strict';

exports = module.exports = {
  serviceName: 'Upwatcher',
  db_prefix: 'upwatcher:',

  API_url: 'https://www.upwork.com',
  API_token_url: '/api/auth/v1/oauth/token/request',
  API_verifier_url: '/services/api/auth',
  API_access_url: '/api/auth/v1/oauth/token/access',
  API_jobs_url: '/api/profiles/v2/search/jobs.json',
  API_jobs_categories_url: '/api/profiles/v2/metadata/categories.json',
  API_job_url: '/api/profiles/v1/jobs/{id}.json',

  notification_interval: 5,

  JOBS_PER_PAGE: 20,

  cacheTTL: 60 * 5 // 5 minutes
};
