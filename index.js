var Dialects = require('./lib/dialects')
  , tu = require('./lib/time_utils')
  , express = require('express')
  , _ = require('underscore')
  , Q = require('./lib/Q')

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

var _cronData = function(jobType) {
  return {title: ['CronJob [', jobType, ']'].join('')}
}

var _scheduleCron = function(jobType, freq, immediate) {
  var envelope = {
     jobType: jobType
    ,jobData: _cronData(jobType)
    //,id: 'CRON~'+jobType
  }

  if (! immediate)
    envelope.when = tu.utc_timestamp() + freq;

  JOBS.push(envelope, function(err){ if (err) LOG.error(err); })
}

var _cronJob = function(jobType, freq) {
  return _.bind(function(job, $done) {
    _scheduleCron(jobType, freq)
    this.crons[jobType](job, $done)
  }, this)
}
  
//~~





//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Worker

var DeeToo = function(config) {
  INIT(config)
  this.jobs = JOBS
  this.log = LOG

  this.procs = {}
  this.crons = {}
  this.dialects = {}

  this.__init__()
}


DeeToo.init = function(config) {
  return DeeToo.__singleton = DeeToo.__singleton || new DeeToo(config)
}


_.extend(DeeToo.prototype, {

  __init__: function() {
    _.bindAll(this, 'can', 'speaks', 'start', 'cron')
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

  ,cron: function(jobType, freq, proc, immediate) {
    this.crons[jobType] = proc
    JOBS.process(jobType, _cronJob.call(this, jobType, freq))

    _scheduleCron(jobType, freq, immediate);

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

  ,shutdown: function($done) {
    if (! __running)
      return;

    LOG.info('Shutting down when all jobs finish...')
    JOBS.shutdown(function() {
      LOG.info('All active jobs have completed. DeeToo is shut down.')
      $done()
    })

    __running = false

    return this
  }

})


module.exports = DeeToo




//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Process is being killed (happens on each new deploy)

process.on('SIGTERM', function() {
  LOG.info('Got SIGTERM. Shutting down when all jobs finish...')
  JOBS.shutdown(function() {
    LOG.info('Finished graceful shutdown')
    process.exit(0)
  }, 10000)
})



//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ A Bad Thing has happened

process.on('uncaughtException', function(err) {
    LOG.error(err)
})

