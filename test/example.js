require('longjohn')

var DeeToo = require('..')
  , util = require('../lib/util.js')
  , _ = require('underscore')
  , d2 = DeeToo.init()

  , JOB_TIME = 5000
  , NUM_JOBS = 8


var __dots = 3
function _dot() {
  if (__dots == 3) console.log('')
  process.stdout.write('. ')
  if (--__dots) setTimeout(_dot, 1000); else console.log('')
}

function _shutdown(exit) {
  return function() {
    console.log('\n~~~ shutting down ~~~\n')

    d2.shutdown(function() {
      console.log('\n~~~ SHUT DOWN ~~~\n')
      if (exit) process.exit(0)
    })
  }
}

function _generateJobs() {
  function mkjob(i) {
    var id = 'demo'+j
    return {jobType:'demonstrate', jobData:{title: id}, id:id}
  }

  function showUpdates(err, job) {
    if (err)
      throw err;
    job.on('progress', function(prog) {
      console.log(['Job', job.id, '@', prog, '%'].join(' '))
    })
  }

  for (var j=0; j<NUM_JOBS; j++) {
    d2.jobs.push(mkjob(j), showUpdates)
  }
}


// An example task that takes 5 seconds to run
// and updates its progress every second.
function processDemonstration(job, $done) {
  function nextStep(){ job.progress(++step, 5) }

  function stop() {
    clearInterval(ticker)
    console.log(['Job', job.id, 'finished!'].join(' '))
    $done()
  }

  var step = 0
    , ticker = setInterval(nextStep, JOB_TIME/5)

  setTimeout(stop, JOB_TIME)
}


// Launch the worker
d2
  .can('demonstrate', 4, processDemonstration)

  .speaks('http')

  .start(function(err) {
    console.log('Example worker has started!')
  })



setTimeout(_generateJobs, 1)

// Demonstrate graceful shutdown
setTimeout(_shutdown(), JOB_TIME * 0.5)

setTimeout(_dot, JOB_TIME * 1.1)

setTimeout(function() {
  console.log('\n~~~ starting back up ~~~\n')
  d2.start(function() {
    console.log('\n~~~ STARTED ~~~\n')
  })
}, JOB_TIME * 1.7)


setTimeout(_shutdown(true), JOB_TIME * 3)


