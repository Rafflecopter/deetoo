
var DeeToo = require('./index')

,   d2 = new DeeToo()


d2.can('shiner', function(job, $done) {
  function nextStep() {
    job.progress(++step, 5)
  }

  function stop() {
    clearTimeout(ticker)
    $done()
  }

  var step = 0
    , ticker = setInterval(nextStep, 2000)

  setTimeout(stop, 10000)

  console.log('SHINER SHINER SHINER')
})

d2.speaks('http')

d2.start()


