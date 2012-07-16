
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



//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//~~ Process push/remove HTTP requests

function httpRequest(operation) {
  var $done = function(err, code, msg) {
    code = code || (!!err ? 500 : 200)
    resp.writeHead(code)
    resp.end(!!err ? err : (msg || ''))
  }

  return function(req, resp) {
    if (! _allowedTypes.indexOf(req.params.jobType))
      return $done('Not a valid job type', 400);

    return OPS[operation](req, resp, $done)
  }
}

function pushJob(req, resp, $done) {
  JOBS.push(req.params.id, req.body.data, req.body.when, $done)
}

function removeJob(req, resp, $done) {
  JOBS.remove(req.params.id, $done)
}
//~~


var HttpDialect = function(options) {
  this.jobs = options.jobs
  this.allowJobTypes(options.allowedJobTypes || [])
  __init = true

  if (options.server_www)
    __listening = true;

  this.server = options.server_www || express.createServer(express.logger())
  this.server.configure(function() {
    this.server.use(express.bodyParser())
  })

  this.server.post(_baseURL, httpRequest('push'))
  this.server.del(_baseURL, httpRequest('remove'))
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



