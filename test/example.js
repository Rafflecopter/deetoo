var DeeToo = require('..')
  , d2 = DeeToo.init()

  , JOB_TIME = 5000


function _generateJobs() {
  function mkjob(i) {
    var id = 'demo'+j
    return {id:id, jobType:'demonstrate', jobData:{title: id}}
  }

  function showUpdates(err, job) {
    job.on('progress', function(prog) {
      console.log(['Job', job.id, '@', prog, '%'].join(' '))
    })
  }

  for (var j=0; j<1; j++) {
      console.log('creating #' + j)
      d2.jobs.push(mkjob(j), showUpdates)
  }
}


// An example process that takes 5 seconds to run
// and updates its progress every second.
function processDemonstration(job, $done) {
  function nextStep(){ job.progress(++step, 5) }

  function stop() {
    clearTimeout(ticker)
    $done()
  }

  var step = 0
    , ticker = setInterval(nextStep, JOB_TIME/5)

  setTimeout(stop, JOB_TIME)
}



// Launch the worker
d2
  .speaks('http')

  .can('demonstrate', 4, processDemonstration)

  .start(function(err) {
    console.log('Example worker has started!')
  })



setTimeout(_generateJobs, 1)

// Demonstrate graceful shutdown
setTimeout(function() {
  console.log('([ shutting down ])')

  d2.shutdown(function() {
    console.log('([ SHUT DOWN ])')
  })
}, JOB_TIME * 2.3)

