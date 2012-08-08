require('longjohn')

var DeeToo = require('..')
  , util = require('../lib/util.js')
  , _ = require('underscore')
  , d2 = DeeToo.init()

  , JOB_TIME = 5000


function _generateJobs() {
  function mkjob(i) {
    var id = 'demo'+j
    return {jobType:'demonstrate', jobData:{title: id}}
  }

  function showUpdates(err, job) {
    if (err)
      throw err;
    job.on('progress', function(prog) {
      console.log(['Job', job.id, '@', prog, '%'].join(' '))
    })
  }

  for (var j=0; j<20; j++) {
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

  .start(function(err) {
    console.log('Example worker has started!')
  })



setTimeout(_generateJobs, 1)

// Demonstrate graceful shutdown
setTimeout(function() {
  console.log('\n([~ shutting down ~])\n')

  d2.shutdown(function() {
    console.log('\n([~ SHUT DOWN ~])\n')
    process.exit(0)
  })
}, JOB_TIME * 2.3)




