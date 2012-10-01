var _ = require('underscore')
,   express = require('express')
,   Dialect = require('./_dialect')

  , __init = false

  , _baseURL = function(id){ 
      return '/api/v2/:jobType' + (id ? '/:id' : '') + '/?$'
    }

  , OPS = {
       push: pushJob
      ,remove: removeJob
    }   

  , JOBS, CONF, jobTypes



function INIT(options) {
  if (__init) return;
  JOBS = options.jobs
  __init = true
}


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Process push/remove HTTP requests

function httpRequest(operation) {
  var self = this
  return function(req, resp) {
    var $done = function(err, code, msg) {
      if (!msg && !_.isNumber(code)) {
        msg = code||''      // `code` is optional
        code = undefined
      }

      code = code || (!!err ? 500 : 200)
      resp.writeHead(code)
      resp.end(!!err ? ''+err : (''+msg || ''))
    }

    if (!~ self._allowedJobTypes.indexOf(req.params.jobType))
      return $done('Not a valid job type', 400);

    return OPS[operation](req, resp, $done)
  }
}

function pushJob(req, resp, $done) {
  function fin(err) {
    if (err)
      return $done(err, 500);

    $done(null, 'OK')
  }

  function _pushOne(job) {
    var envelope = {
       jobType: req.params.jobType
      ,jobData: job.jobData
      ,when: job.when
      ,id: job.id
    }

    JOBS.push(envelope, fin)
  }

  var jobs = _.isArray(req.body) ? req.body : [req.body]
  _.each(jobs, _pushOne)
}

function removeJob(req, resp, $done) {
  function fin(err) {
    if (err)
      return $done(err, 500);

    return $done(null, 'OK')
  }

  JOBS.remove(req.params.jobType, req.params.id, fin)
}
//~~


var HttpDialect = function(options) {
  var inst = this
    , CONF = options._config

  INIT(options)
  this.jobs = JOBS
  this.allowJobType(options.allowedJobTypes || [])
  __init = true

  this.server = options.server_www || express.createServer(express.logger())
  this.server.use(express.bodyParser())

  if (CONF.auth)
    this.server.use('/api', express.basicAuth(CONF.auth.user, CONF.auth.pass));

  // TODO: shouldn't require an `id`
  this.server.get(_baseURL(), function(q,r){ r.end('test') })
  this.server.post(_baseURL(), httpRequest.call(this, 'push'))
  this.server.del(_baseURL(true), httpRequest.call(this, 'remove'))
}

HttpDialect.prototype = _.extend({}, Dialect, {

  listen: function($done) {
    // deetoo will initialize the HTTP server. We don't need to do it here.
    $done()
  }

  ,shutdown: function($done) {
    this.server.close($done)
  }
  
})


module.exports = HttpDialect



