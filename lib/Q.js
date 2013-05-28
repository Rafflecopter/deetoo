var _ = require('underscore')
  , util = require('./util')
  , async = require('async')
  , redis = require('redis')
  , reds = require('reds')
  , fs = require('fs')

  , kue = require('kue')

  , __init = false

  , JOBS, RED, CONF, LOG


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



//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Optional Garbage Collection

var _appendFile = function(filename, msg, $done) {
  var __open = _.bind(fs.open, fs, filename, 'a')
    , __write = util.partial.call(fs, fs.write, undefined, msg)
    , __close = util.partial.call(fs, fs.close)
  async.waterfall([__open, __write, __close], $done)
}

var _garbageCollect = function(job, mappedID) {
  var __rmJob = _.bind(removeJob, null, job.id)
    , flow = [__rmJob]

  // TODO: some repeated logic here & removeMappedJob

  if (!! mappedID)
    flow.push(_.bind(unmapID, null, job.type, mappedID));

  async.parallel(flow, function(err) {
    if (err)
      return LOG.error(err);    // keep calm and carry on
  })
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
    if (err) {
      // TODO: get rid of this hack when we switch to a different queue
      // hack for dealing with "job '<num>' doesnt exist" error
      if (!!~err.message.indexOf('doesnt exist'))
        return $done()

      return $done(err);

    } else if (job) {
      job.remove($done);
    }
  })
}


function removeMappedJob(jobType, id, unmap, $done) {
  function rmIfExists(existing, $_done) {
    if (! existing)
      return $_done(null, false);

    LOG.info(['Replacing old job <', id, '>'].join(''))

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
    , now = Date.now()
    , msg = ['Creating new job:', envelope.id, 
             '(', envelope.jobData.title, ')'].join(' ')
    , delay

  if (envelope.when) {
    delay = envelope.when - now
    newJob.delay(delay);
    msg = [msg, '-- running in', delay, 'ms'].join(' ')
  }

  if (CONF.garbage_collect) {
    newJob.on('complete', _.bind(_garbageCollect, null, newJob, envelope.id))
  }

  LOG.info(['UTC:'+(Date.now()), msg].join(' -- '))
  newJob.save(function(err) {
    var $_done = util.partial($done, undefined, newJob)
    var $__done = function(e){ $_done(e) }

    if (envelope.id)
      return mapID(envelope.jobType, envelope.id, newJob.id, $__done);

    $_done(err)
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

  /* envelope:
   *    jobType: a <String> job type for kue
   *    jobData: payload to be saved w/ job in redis
   *    [id]: our "custom" id for later reterival
   *    [when]: a timestamp (in milliseconds) when the job should run (in UTC)
   */
  push: function(envelope, $done) {
    var __pushJob = _.bind(pushNewJob, null, envelope)
      , flow = [__pushJob]

    if (envelope.id) {
      var __rmJob = _.bind(removeMappedJob, null, envelope.jobType, envelope.id)
      flow = [__rmJob].concat(flow)
    }

    async.series(flow, function(err, results) {
      var _job = results.length > 1 ? results[1] : results[0]
        , _rm = results.length > 1 ? results[0] : null

      if (_rm)
        LOG.info(['Replaced old job [', envelope.id, ']'].join(' '));

      $done(err, _job)
    })
  }

  ,remove: function(jobType, id, $done) {
    function fin(err) {
      if (err)
        return $done(err);

      LOG.info(['Removed job "', id, '"'].join(''))
      $done()
    }

    // if only passed [id, $done], assume `id` is a kue id
    if (! $done)
      $done=id, id=jobType, jobType=null;

    if (jobType)
      removeMappedJob(jobType, id, true, fin);
    else
      removeJob(id, fin);
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


