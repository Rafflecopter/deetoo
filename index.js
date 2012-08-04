var Dialects = require('./lib/dialects')
  , express = require('express')
  , _ = require('underscore')
  , async = require('async')
  , Q = require('./lib/Q')

  , LOG = require('book').default()
  , WWW = express.createServer(express.logger())
  , CONF = require('./config_default')

  , _asyncNull = function(f){f()}
  
  , __listening = false
  , __init = false
  
  , _preprocs = {}

  , JOBS




//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ One-time setup
function INIT(config) {
  if (__init) return;

  CONF = _.extend(CONF, config)

  LOG = LOG.use(require('./lib/sentry')(config))

  JOBS = Q.init(CONF)

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
//~~ Util Functions

var DeeToo = function(config) {
  INIT(config)
  this.jobs = JOBS
  this.log = LOG

  this.procs = {}
  this.preprocs = {}
  this.dialects = {}

  this.__init__()
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
    if (! proc) {
        proc = n
        n = 1
    }

    this.procs[jobType] = proc
    JOBS.process(jobType, n, _procJob.call(this, jobType))

    _.each(this.dialects, function(dia) {
      dia.allowJobType(jobType)
    })
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
        LOG.info(msg)
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

  ,shutdown: function($done) {
    LOG.info('Shutting down when all jobs finish...')
    JOBS.shutdown($done)
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

