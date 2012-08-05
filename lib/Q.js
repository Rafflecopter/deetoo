var _ = require('underscore')
,   async = require('async')
,   redis = require('redis')
,   reds = require('reds')
,   kue = require('kue')

,   __init = false

,   JOBS, RED, CONF, LOG


/* TODO:
 *  Updating a job (or removing one in general) is unnecessarily slow.
 *  Optimize sometime later.
 *
 *  Removing requires 3 round-trips:
 *      - lookup ID -> kue_id
 *      - lookup job<kue_id>
 *      - remove job<kue_id>
 *
 *  Updating requires 2 more:
 *      - save new job
 *      - map new id
 */




//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Util Functions

function mapkey(jobType) {
  return ['q', 'idmap', jobType].join(':')
}

function utc_timestamp() {
    var d = new Date()
    return d.getTime() + (d.getTimezoneOffset() * 60 * 1000)
}

function removeJob(kid, $done) {
  $done = $done || function(){}
  kue.Job.get(kid, function(err, job) {
    if (err)
      return $done(err);
    else (job)
      job.remove($done);
  })
}


function removeMapped(jobType, id, $done) {
  RED.hget(mapkey(jobType), id, function(err, existing) {
    if (existing) {
      // TODO: should be able to use redis pipeline
      removeJob(existing, function(err) {
        if (err)
          $done(err);

        RED.hdel(mapkey(jobType), id, $done)
      })
    } else {
      $done(null, false)
    }
  })
}




//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ One-time setup

function INIT(config) {
  if (__init) return;

  CONF = config

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

  JOBS.promote()

  __init = true
}




function Q(config, log) {
  INIT(config)
  this._rawQueue = JOBS
  LOG = log
}


Q.init = function(config, log) {
  return Q.__singleton = Q.__singleton || new Q(config, log)
}


_.extend(Q.prototype, {

  /* Params
   *    jobType: a <String> job type for kue
   *    id: our "custom" id for later reterival
   *    jobData: payload to be saved w/ job in redis
   *    [when]: a timestamp (in milliseconds) when the job should run (in UTC)
   *    $done: callback
   */
  push: function(envelope, $done) {
    function createJob(found, $_done) {
      if (found) {
        LOG.info('Removed old version of job ' + envelope.id)
      }

      var msg = '  creating job '+envelope.id+' '+ envelope.jobData.title + '...';
      LOG.info(msg)
      $_done(null, JOBS.create(envelope.jobType, envelope.jobData))
    }

    function saveJob(job, $_done) {
      // TODO: this is messy. clean up.
      function save($__done) {
        job.save($__done)
      }

      function mapID($__done) {
        if (envelope.id)
          RED.hset(mapkey(envelope.jobType), envelope.id, job.id, $__done);
        else
          $__done();
      }

      if (envelope.when)
        job.delay(parseInt(envelope.when, 10) - utc_timestamp());

      async.series([save, mapID], $_done)
    }

    // curry removeMapped, leaving only $callback to be passed
    var _removeMapped = _.bind(removeMapped, {}, 
                                 envelope.jobType, envelope.id)

    async.waterfall([_removeMapped, createJob, saveJob], $done)
  }

  ,remove: function(jobType, id, $done) {
    removeMapped(jobType, id, function(err) {
      if (err)
        return $done(err);

      var msg = 'Removed job "' + id + '"';
      LOG.info(msg)
      $done()
    })
  }

  ,process: function() {
    JOBS.process.apply(JOBS, arguments)
  }

  ,on: function() {
    JOBS.on.apply(JOBS, arguments)
  }

  ,shutdown: function() {
    JOBS.shutdown.apply(JOBS, arguments)
  }

})

Q.kue = kue


module.exports = Q


