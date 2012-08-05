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

function utc_timestamp(prefix) {
  var d = new Date()
  prefix = prefix || ''
  return [prefix, d.getTime() + (d.getTimezoneOffset() * 60 * 1000)].join('')
}

function partialError($func) {
  // returns a partially-applied function // which can be called w/ just an 
  // 'err' as a first argument
  var args = Array.prototype.slice.call(arguments, 1)
  return function(err) {
    $func.apply(this, [err].concat(args))
  }
}



//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Job Push/Update Flow


function unmapID(jobType, customID, job, $done) {
  RED.hdel(mapkey(jobType), customID, $done)
}


function mapID(jobType, customID, kid, $done) {
  RED.hset(mapkey(jobType), customID, kid, $done)
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


function removeMappedJob(jobType, id, unmap, $done) {
  function rmIfExists(existing, $_done) {
    if (! existing)
      return $_done(null, false);

    removeJob(existing, function(err) {
      $_done(err, id)
    })
  }

  // partially apply, leaving only the callback to be passed
  var findMappedID = _.bind(RED.hget, RED, mapkey(jobType), id)

  if (! $done) {
    $done = unmap
    unmap = null
  }

  async.waterfall([findMappedID, rmIfExists], function() {
    if (unmap)
      unmapID(jobType, id);

    $done.apply(this, arguments)    // return `id`
  })
}


function pushNewJob(envelope, $done) {
  var newJob = JOBS.create(envelope.jobType, envelope.jobData)
    , msg = ['Creating new job: ', envelope.id, '(', envelope.jobData.title, ')'].join(' ')

  LOG.info([utc_timestamp('UTC:'), msg].join(' -- '))
  newJob.save(function(err) {
    var __$done = partialError($done, newJob)

    if (envelope.id) {
      return mapID(envelope.jobType, envelope.id, newJob.id, __$done);
    }

    __$done(err)
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
    var __rmJob = _.bind(removeMappedJob, null, envelope.jobType, envelope.id)
      , __pushJob = _.bind(pushNewJob, null, envelope)

      , flow = {rm:__rmJob, job:__pushJob}

    async.parallel(flow, function(err, results) {
      $done(err, results.job)
    })
  }

  ,remove: function(jobType, id, $done) {
    removeMappedJob(jobType, id, true, function(err) {
      if (err)
        return $done(err);

      LOG.info('Removed job "' + id + '"')
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


