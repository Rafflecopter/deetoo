var _ = require('underscore')
,   redis = require('redis')
,   reds = require('reds')
,   kue = require('kue')

,   CONF = require('./config_default')

,   __startup = false

,   JOBS, RED



function STARTUP(config) {
  if (__startup) return;

  CONF = _.extend(CONF, config)

  if (!! CONF.redis) {
    // TODO: avoid this hassle if https://github.com/LearnBoost/kue/issues/54 
    //       ever gets fixed
    reds.createClient = function() {
      var client = redis.createClient(CONF.redis.port, CONF.redis.host)
      client.auth(CONF.redis.pass)
      return client
    }

    kue.redis.createClient = reds.createClient
  }

  JOBS = kue.createQueue()
  RED = JOBS.client

  __startup = true
}


var Q = function(config) {
  STARTUP()
  this.__init__()
}

_.extend(Q.prototype, {

  __init__: function() {
    //_.bindAll(this)
  }

  ,push: function(id, job, when, $done) {
    if (! $done)
      $done = when;     // `when` is optional

    // TCB
  }

  ,remove: function(id, $done) {
    // TCB
  }

})


module.exports = Q


