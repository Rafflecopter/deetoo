var _ = require('underscore')
  , async = require('async')
  , Dialects = require('./dialects')
  , Q = require('./Q')
  , express = require('express')

  , CONF = require('./config_default')
  , WWW = express.createServer(express.logger())
  
  , _preprocs = {}

  , __init = false
  , __listening = false

  , _asyncNull = function(d){d()}
  
  , raven, _errlog, JOBS


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


function INIT(config) {
  if (__init) return;
  JOBS = new Q()
  __init = true

  WWW.use(Q.kue.app)
}



//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Util Functions

var _procJob = function(jobType) {
  return _.bind(function(job, $done) {
    this.procs[jobType](job, $done)
  }, this)
}
//~~


var DeeToo = function(config) {
  INIT()
  this.jobs = JOBS

  this.procs = {}
  this.preprocs = {}
  this.dialects = {}

  this.__init__()
}

_.extend(DeeToo.prototype, {

  __init__: function() {
    _.bindAll(this, 'can', 'preprocess', 'speaks', 'start')
  }

  //~~ Public Interface
  ,can: function(jobType, proc) {
    this.procs[jobType] = proc
    //this.jobs.process(jobType, _procJob.call(this, jobType))

    _.each(this.dialects, function(dia) {
      dia.allowJobType(jobType)
    })
  }

  ,preprocess: function(jobType, preproc) {
    _preprocs[jobType] = preproc
  }

  ,speaks: function() {
    var arr = _.toArray(arguments)
    ,   inst = this
      , options = {
           allowedJobTypes: _.keys(this.procs)
          ,server_www: WWW
        }

    arr.forEach(function(dia) {
      if (! _.has(Dialects, dia))
        return;

      if (_.has(inst.dialects, dia))
        return;

      inst.dialects[dia] = new Dialects[dia](options)
    })
  }
  
  ,start: function(setup, $done) {
    function GO(setupErr) {
      if (setupErr) return $done(setupErr);

      WWW.listen(CONF.port_www, function(err) {
        console.log('Worker started. Admin UI on HTTP port ' + CONF.port_www)
        $done(err)
      })
    }

    if (!$done) {
      $done = setup
      setup = [_asyncNull]
    }

    setup = _.isArray(setup) ? setup : [setup]

    async.parallel(setup, GO)
  }
  //~~

})


module.exports = DeeToo


