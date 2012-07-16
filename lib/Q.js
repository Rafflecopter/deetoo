var _ = require('underscore')
,   async = require('async')
,   redis = require('redis')
,   reds = require('reds')
,   kue = require('kue')

,   CONF = require('./config_default')

,   __init = false

,   JOBS, RED


function mapkey(jobType) {
  return ['q', 'idmap', jobType].join(':')
}



function INIT(config) {
  if (__init) return;

  CONF = _.extend(CONF, config)

  if (!! CONF.redis) {
    // TODO: avoid this hassle if https://github.com/LearnBoost/kue/issues/54 
    //       ever gets fixed
    reds.createClient = function() {
      var client = redis.createClient(CONF.redis.port, CONF.redis.host)
      client.auth(CONF.redis.pass)
      return client
    }

    kue.redis.createClient = reds.createClient
  }

  JOBS = kue.createQueue()
  RED = JOBS.client

  __init = true
}


function removeExisting(jobType, id, $done) {
  RED.hget(mapkey(jobType), id, function(err, existing) {
    if (existing)
      kue.Job.remove(existing, function(err) {
        $done(err, true)
      });
    else
      $done(null, false)
  })
}


var Q = function(config) {
  INIT(config)
  JOBS.promote()
}

_.extend(Q.prototype, {

  /* Params
   *    jobType: a <String> job type for kue
   *    id: our "custom" id for later reterival
   *    jobData: payload to be saved w/ job in redis
   *    [when]: a <Date> when the job should run (in UTC)
   *    $done: callback
   */
  push: function(jobType, id, jobData, when, $done) {
    function createJob(found, $_done) {
      if (found)
        console.log('REMOVED OLD JOB ' + id);

      console.log('  creating job ' + id + '...')
      $_done(null, JOBS.create(jobType, jobData))
    }

    function saveJob(job, $_done) {
      // TODO: this is messy. clean up.
      function save($__done) {
        job.save($__done)
      }

      function mapID($__done) {
        RED.hset(mapkey(jobType), id, job.id, $__done)
      }

      if (when)
        job.delay(when - (new Date));

      console.log('  saving job...')
      async.parallel([save, mapID], $_done)
    }

    // curry removeExisting, leaving only $callback to be passed
    var _removeExisting = _.bind(removeExisting, {}, jobType, id)

    if (! $done) {
      $done = when      // `when` is optional
      when = undefined
    }

    console.log('pushing job ' + id + '...')
    async.waterfall([_removeExisting, createJob, saveJob], $done)
  }

  ,remove: function(jobType, id, $done) {
    removeExisting(id, function(err) {
      if (err)
        return $done(err);

      RED.del(KEYS.mapID(id), $done)
    })
  }

  ,process: function() {
    JOBS.process.apply(JOBS, _.toArray(arguments))
  }

})

Q.kue = kue


module.exports = Q


