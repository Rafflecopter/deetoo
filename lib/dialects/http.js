
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
    if (!~ self._allowedJobTypes.indexOf(req.params.jobType))
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
     jobType: req.params.jobType
    ,jobData: req.body.jobData
    ,when: req.body.when
    ,id: req.body.id
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

  this.server = options.server_www || express.createServer(express.logger())
  this.server.use(express.bodyParser())

  // TODO: shouldn't require an `id`
  this.server.get(_baseURL(), function(q,r){ r.end('test') })
  this.server.post(_baseURL(), httpRequest.call(this, 'push'))
  this.server.del(_baseURL(true), httpRequest.call(this, 'remove'))
}

HttpDialect.prototype = _.extend({}, Dialect, {

  listen: function($done) {
    if (! this.server)
      return $done('Server not initialized!');

    if (!! this.server._handle) // already listening
      return $done();
    
    this.server.listen(CONF.port_www||8080, function(err) {
      console.log('Started server. Listening on port ' + CONF.port_www)
      $done(err)
    })
  }

  ,shutdown: function($done) {
    this.server.close($done)
  }
  


////////////////////////////////////////////////////////////////////////////////
//
//
//  TODO
//
//      - actually call .listen() on dialects from index.js
//
//
////////////////////////////////////////////////////////////////////////////////



})


module.exports = HttpDialect



