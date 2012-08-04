var DeeToo = require('./index')
  , d2 = DeeToo.init()


function _generateJobs() {
  //for (var j=0; j<12; j++) {
      //console.log('creating #' + j)
      //jobs.create('shiner', {title:'testing ' + j}).save()
  //}
}



/* An example process that takes 10 seconds to run
 * and updates its progress every 2 seconds 
 */
function processExample = function(job, $done) {
  function nextStep() {
    console.log(['Job', job.id, '@', job.progress, '%'].join(' ')
    job.progress(++step, 5)
  }

  function stop() {
    clearTimeout(ticker)
    $done()
  }

  var ticker = setInterval(nextStep, 2000)
    , step = 0

  setTimeout(stop, 10000)
}


d2
  .speaks('http')

  .can('example', processExample)

  .start(function(err) {
    console.log('Example worker has started!')
  })



setTimeout(_testJobs, 1000)

