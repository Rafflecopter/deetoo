
var _ = require('underscore')
,   express = require('express')
,   Dialect = require('./_dialect')

  , __init = false
  , __listening = false

  , _baseURL = '/api/v1/:jobType/:id/?$'

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
    if (! self._allowedJobTypes.indexOf(req.params.jobType))
      return $done('Not a valid job type', 400);

    var $done = function(err, code, msg) {
      if (!msg && !_.isNumber(code)) {
        msg = code||''      // `code` is optional
        code = undefined
      }

      code = code || (!!err ? 500 : 200)
      resp.writeHead(code)
      resp.end(!!err ? ''+err : (''+msg || ''))
    }

    return OPS[operation](req, resp, $done)
  }
}

function pushJob(req, resp, $done) {
  function fin(err) {
    if (err)
      return $done(err, 500);

    $done(null, 'OK')
  }

  var envelope = {
     id: req.params.id
    ,jobType: req.params.jobType
    ,jobData: req.body.data
    ,when: req.body.when
  }

  JOBS.push(envelope, fin)
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

  INIT(options)
  this.jobs = JOBS
  this.allowJobType(options.allowedJobTypes || [])
  __init = true

  if (options.server_www)
    __listening = true;

  this.server = options.server_www || express.createServer(express.logger())
  this.server.configure(function() {
    inst.server.use(express.bodyParser())
  })

  // TODO: shouldn't require an `id`
  this.server.get(_baseURL, function(q,r){ r.end('test') })
  this.server.post(_baseURL, httpRequest.call(this, 'push'))
  this.server.del(_baseURL, httpRequest.call(this, 'remove'))
}

HttpDialect.prototype = _.extend({}, Dialect, {

  listen: function(options, $done) {
    if (__listening) return;

    if (!WWW)
      return $done('Server not initialized!');
    
    WWW.listen(CONF.port_www||8080, function() {
      console.log('Started server. Listening on port ' + CONF.port_www)
      __listening = true
    })
  }

})


module.exports = HttpDialect



