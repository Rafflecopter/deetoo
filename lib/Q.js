var _ = require('underscore')
,   async = require('async')
,   redis = require('redis')
,   reds = require('reds')
,   kue = require('kue')

,   __init = false

,   JOBS, RED, CONF


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


function mapkey(jobType) {
  return ['q', 'idmap', jobType].join(':')
}



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

  if (config.remove_completed)
    JOBS.on('job complete', removeJob);

  __init = true
}


function removeJob(kid, $done) {
  $done = $done || function(){}
  kue.Job.get(kid, function(err, job) {
    if (err) return $done(err);
    if (!job) return $done();
    RED.hdel(mapkey(job.type), [job.data.user, job.data.raffle_num].join('-'), function() {}) 
    job.remove(function(err) {
      var msg = 'Removed job #' + kid;
      CONF.log.info(msg)
      $done(err)
    })
  })
}


function removeExisting(jobType, id, $done) {
  RED.hget(mapkey(jobType), id, function(err, existing) {
    function rm($_done) {
      removeJob(existing, $_done)
    }

    function unmapID($_done) { RED.hdel(mapkey(jobType), id, $_done) }

    if (existing)
      // TODO: should be able to use redis pipeline
      async.parallel([rm, unmapID], function(err) {
        $done(err, true)
      })
    else
      $done(null, false)
  })
}


var Q = function(config) {
  INIT(config)
}

_.extend(Q.prototype, {

  /* Params
   *    jobType: a <String> job type for kue
   *    id: our "custom" id for later reterival
   *    jobData: payload to be saved w/ job in redis
   *    [when]: a <Date> when the job should run (in UTC)
   *    $done: callback
   */
  push: function(envelope, $done) {
    function createJob(found, $_done) {
      if (found) {
        CONF.log.info('Removed old version of job ' + envelope.id)
      }

      var msg = '  creating job '+envelope.id+' '+ envelope.jobData.title + '...';
      CONF.log.info(msg)
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
        job.delay(parseInt(envelope.when, 10) - (new Date));

      async.series([save, mapID], $_done)
    }

    // curry removeExisting, leaving only $callback to be passed
    var _removeExisting = _.bind(removeExisting, {}, 
                                 envelope.jobType, envelope.id)

    async.waterfall([_removeExisting, createJob, saveJob], $done)
  }

  ,remove: function(jobType, id, $done) {
    removeExisting(jobType, id, function(err) {
      if (err)
        return $done(err);

      RED.hdel(mapkey(jobType), id, $done)
    })
  }

  ,process: function() {
    JOBS.process.apply(JOBS, _.toArray(arguments))
  }

})

Q.kue = kue


module.exports = Q


