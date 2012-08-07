var Dialects = require('./lib/dialects')
  , util = require('./lib/util')
  , express = require('express')
  , _ = require('underscore')
  , async = require('async')
  , Q = require('./lib/Q')
  , fs = require('fs')

  , LOG = require('book').default()
  , WWW = express.createServer(express.logger())
  , CONF = require('./config_default')

  , __running = false
  , __init = false

  , JOBS




//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ One-time setup

function INIT(config) {
  if (__init) return;

  CONF = _.extend(CONF, config)

  LOG = LOG.use(require('./lib/sentry')(CONF))

  JOBS = Q.init(CONF, LOG)

  WWW.use(express.bodyParser())
  WWW.use(Q.kue.app)

  if (CONF.auth)
    WWW.use(express.basicAuth(CONF.auth.user, CONF.auth.pass));

  __init = true
}




//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Util Functions

var _procJob = function(jobType) {
  return _.bind(function(job, $done) {
    this.procs[jobType](job, $done)
  }, this)
}
  
//~~





//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Worker

var DeeToo = function(config) {
  INIT(config)
  this.__init__()

  this.jobs = JOBS
  this.log = LOG

  this.procs = {}
  this.dialects = {}
}


DeeToo.init = function(config) {
  return DeeToo.__singleton = DeeToo.__singleton || new DeeToo(config)
}


_.extend(DeeToo.prototype, {

  __init__: function() {
    _.bindAll(this, 'can', 'speaks', 'start')
  }

  //~~ Public Interface
  ,can: function(jobType, n, proc) {
    // `n` is optional
    if (!proc) { proc=n; n=1; }

    this.procs[jobType] = proc
    JOBS.process(jobType, n, _procJob.call(this, jobType))

    _.each(this.dialects, function(dia) {
      dia.allowJobType(jobType)
    })

    return this
  }

  ,speaks: function() {
    var arr = _.toArray(arguments)
      , inst = this
      , options = {
           allowedJobTypes: _.keys(this.procs)
          ,server_www: WWW
          ,jobs: JOBS
        }

    arr.forEach(function(dia) {
      if ((! _.has(Dialects, dia)) || _.has(inst.dialects, dia))
        return;

      inst.dialects[dia] = new Dialects[dia](options)
    })

    return this
  }
  
  ,start: function($done) {
    WWW.listen(CONF.port_www, function(err) {
      if (!err) {
        var msg = 'Worker started. Admin UI on HTTP port ' + CONF.port_www
        LOG.info(msg)
        __running = true
      }

      $done(err)
    })

    return this
  }

  ,shutdown: function(timeout, $done) {
    if (! __running)
      return;

    if (! $done)    // timeout is optional
      $done=timeout, timeout=null;

    __running = false

    LOG.info('Shutting down when all jobs finish...')
    JOBS.shutdown(function() {
      LOG.info('All active jobs have completed. DeeToo is shut down.')
      $done()
    }, timeout)

    return this
  }

})


module.exports = DeeToo




//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Process is being killed (happens on each new deploy)

process.on('SIGTERM', function() {
  LOG.info('([~~~ Got SIGTERM ~~~])')

  if (DeeToo.__singleton) {
    DeeToo.__singleton.shutdown(CONF.sigterm_shutdown_timeout, function() {
      LOG.info('([~~~ Exiting ~~~])')
      process.exit(0)
    })
  }
})



//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ A Bad Thing has happened

process.on('uncaughtException', function(err) {
    LOG.error(err)
})

