var _ = require('underscore')
  , async = require('async')
  , redis = require('redis')
  , reds = require('reds')
  , kue = require('kue')

  , CONF = require('./config_default')
  
  , _preprocs = {}

  , __setup = false
  , __listening = false
  
  , raven, _errlog, JOBS, RED


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Logging

if (CONF.sentry) {
  raven = require('raven')
  _errlog = new raven.Client(CONF.sentry)
}

function LOGERR(msg) {
  if (!_errlog)
    return console.log('ERROR! - ' + msg);

  if (! msg instanceof Error)
    msg = new Error(msg);

  _errlog.captureError(msg)
}
//~~


function global_setup(config) {
  if (__setup) return;

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

  __setup = true
}



//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Util Functions

var _procJob = function(jobType) {
  return _.bind(this, function(job, $done) {
    this.proc[jobType](job, $done)
  })
}
//~~


var DeeToo = function(jobType, config) {
  global_setup()
  this.Q = JOBS
  this.redis = Q.client

  this.procs = {}
  this.preprocs = {}

  this.__init__()
}

_.extend(DeeToo.prototype, (function() {

  __init__: function() {
    var meth = ['can', 'preprocess', 'speak', 'start',
                '_procJob']
    _.bindAll(this, meth)
  }

  //~~ Public Interface
  ,can: function(jobType, proc) {
    this.procs[jobType] = proc
    this.Q.process(jobType, _procJob.call(this, jobType))
  }

  ,preprocess: function(jobType, preproc) {
    _preprocs[jobType] = preproc
  }

  ,speak: function() {
    var dialects = _.toArray(arguments)
    // TODO
  }
  
  ,start: function(setup, $done) {
    function GO(setupErr) {
      if (setupErr) return $done(setupErr);

      // startup stuff
    }

    setup = (!setup || _.isArray(setup)) ? setup : [setup]

    async.parallel(setup, GO)
  }
  //~~

}()))




module.exports = DeeToo


