var Dialects = require('./lib/dialects')
  , express = require('express')
  , _ = require('underscore')
  , async = require('async')
  , Q = require('./lib/Q')
  , log = require('book').default()

  , WWW = express.createServer(express.logger())
  , CONF = require('./config_default')

  , _asyncNull = function(f){f()}
  
  , __listening = false
  , __init = false
  
  , _preprocs = {}

  , JOBS


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Initializing 
function INIT(config) {
  if (__init) return;

  CONF = _.extend(CONF, config)

  CONF.log = log.use(require('./lib/sentry'))

  JOBS = new Q(CONF)

  WWW.configure(function() {
    WWW.use(express.bodyParser())
  })
  if (CONF.auth.user && CONF.auth.pass)
    WWW.use(express.basicAuth(CONF.auth.user, CONF.auth.pass))
  WWW.use(Q.kue.app)

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


var DeeToo = function(config) {
  INIT(config)
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
    JOBS.process(jobType, _procJob.call(this, jobType))

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
          ,jobs: JOBS
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
        var msg = 'Worker started. Admin UI on HTTP port ' + CONF.port_www;
        CONF.log.info(msg)
        $done(err)
      })
    }

    if (!$done) {
      $done = setup || function(){}
      setup = [_asyncNull]
    }

    setup = _.isArray(setup) ? setup : [setup]

    async.parallel(setup, GO)
  }
  //~~

})


module.exports = DeeToo




//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Process is being killed (happens on each new deploy)

process.on('SIGTERM', function() {
  CONF.log.info('Got SIGTERM. Shutting down when all jobs finish...')
  JOBS.shutdown(function() {
    CONF.log.info('Finished graceful shutdown')
    process.exit(0)
  }, 10000)
})



//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ A Bad Thing has happened

process.on('uncaughtException', function(err) {
    CONF.log.error(err)
})

