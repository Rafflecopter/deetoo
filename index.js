var Dialects = require('./lib/dialects')
  , util = require('./lib/util')
  , express = require('express')
  , memwatch = require('memwatch')
  , _ = require('underscore')
  , async = require('async')
  , Q = require('./lib/Q')
  , u = require('util')
  , fs = require('fs')

  , LOG = require('book').default()
  , WWW = express.createServer(express.logger())
  , CONF = require('./config_default')

  , __running = {process:false, listen:false}
  , __init = false

  , __processors = {}
  , __dialects = {}

  , _nullfunc = function(){}

  , JOBS, HEAPSNAP




//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ One-time setup

function INIT(config) {
  if (__init) return;

  CONF = _.extend(CONF, config)

  LOG = LOG.use(require('./lib/sentry')(CONF.sentry))

  JOBS = Q.init(CONF, LOG)

  if (CONF.auth)
    WWW.use('/'+CONF.admin_url_prefix,
            express.basicAuth(CONF.auth.user, CONF.auth.pass));

  WWW.use(express.bodyParser())
  WWW.use('/'+CONF.admin_url_prefix, Q.kue.app)

  __init = true
}




//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Util Functions

var _startProcessing = function($done) {
  function procType(kv, $_done) {
    var jobType=kv[0], func=kv[1]
    JOBS.process(jobType, func._concurrent, func)
    $_done()
  }

  // TODO: wouldn't need to do this if async.forEach() took an object
  var _procs = _.zip(_.keys(__processors), _.values(__processors))

  async.forEach(_procs, procType, function(err) {
    if (err) return $done(err);
    __running.process = true
    $done()
  })
}
  
var _stopProcessing = function(timeout, $done) {
  LOG.info('([> Shutting down when all active jobs have finished... <])')
  JOBS.shutdown(function() {
    __running.process = false
    LOG.info('([> All active jobs have completed. DeeToo is NOT processing jobs. <])')
    $done()
  }, timeout)
}

var _startListening = function($done) {
  var _bind = function(dia){ return _.bind(dia.listen, dia) }
    , _listeners = _.map(__dialects, _bind)

  async.parallel(_listeners, function(err) {
    if (err || WWW._handle)     // _handle means server is already listening
      return $done(err);

    WWW.listen(CONF.port_www, CONF.hostname_www, function(err) {
      if (!err) {
        var msg = 'Admin UI running on '
        __running.listen = true
        LOG.info(msg + [CONF.hostname_www, CONF.port_www].join(':'))
      }
      $done(err)
    })
  })
}

var _stopListening = function($done) {
  function dstop(d, $_done){ d.shutdown($_done) }

  var self = this

  LOG.info('([> Shutting down all listeners... <])')
  async.forEach(__dialects, dstop, function(err) {
    if (err) return $_done(err);
    WWW.close($done)
    __running.listen = false
    LOG.info('([> All listeners have stopped listening. <])')
  })
}

//~~





//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Worker

var DeeToo = function(config) {
  INIT(config)
  this.__init__()

  this.log = LOG
  this.jobs = JOBS

  this._ = {
     www: WWW
    ,redis: JOBS._rawQueue.client
  }

  // Memory management
  HEAPSNAP = new memwatch.HeapDiff()
  //setTimeout(function(info) {
  memwatch.on('leak', function(info) {
    if (process.memoryUsage().rss > (CONF.rss_threshold || 128000000)) {
      this.shutdown(CONF.sigterm_shutdown_timeout, function() {
        LOG.warn('Leak detected ---> Heap Diff: \n', 
                 u.inspect(HEAPSNAP.end(), false, null))

        LOG.info('([~~~ Exiting ~~~])')

        process.exit(0)
      })

    } else {
        LOG.info('Possible leak detected: \n', 
                 u.inspect(info || {}, false, null))
    }
  }.bind(this))
  //}.bind(this), 1000)
}


DeeToo.init = function(config) {
  return DeeToo.__singleton = DeeToo.__singleton || new DeeToo(config)
}


_.extend(DeeToo.prototype, {

  __init__: function() {
    _.bindAll(this, 'can', 'speaks', 'start', 'shutdown')
  }

  //~~ Public Interface
  ,can: function(jobType, n, proc) {
    // `n` is optional
    if (!proc) { proc=n; n=1; }

    proc._concurrent = n
    __processors[jobType] = proc

    _.each(__dialects, function(dia) {
      dia.allowJobType(jobType)
    })

    return this
  }

  ,speaks: function() {
    var arr = _.toArray(arguments)
      , inst = this
      , options = {
           allowedJobTypes: _.keys(__processors)
          ,server_www: WWW
          ,jobs: JOBS
          ,_config: CONF
        }

    arr.forEach(function(dia) {
      if ((! _.has(Dialects, dia)) || _.has(__dialects, dia))
        return;

      __dialects[dia] = new Dialects[dia](options)
    })

    return this
  }
  
  ,start: function($done) {
    var flow = []

    $done = $done || _nullfunc

    !__running.process && flow.push(_startProcessing)
    !__running.listen && flow.push(_startListening)

    // TODO: can this be parallel?
    async.series(flow, function(err) {
      LOG.info('([> DeeToo has started listening & processing jobs <])')
      $done()
    })
  }

  ,shutdown: function(timeout, deaf, $done) {
    function _optArgs() {   // timeout & deaf are both optional
      if (deaf === undefined) {
        $done=timeout; timeout=null;
      } else if (! $done) { // infer which arg was passed
        $done = deaf;
        deaf = !_.isFinite(timeout) ? timeout : null
        timeout = !!deaf ? null : timeout
      }

      $done = $done || _nullfunc
    }

    var flow = []
      , self = this

    _optArgs()

    // Determine which functions need to be run
    __running.process && flow.push(_.bind(_stopProcessing, null, timeout))
    deaf && __running.listen && flow.push(_stopListening)

    // Stop whatever should be stopped
    async.parallel(flow, $done)

    return this     // chain
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
