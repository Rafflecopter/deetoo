
var DeeToo = require('./lib/deetoo')

,   d2 = new DeeToo()


d2.can('shiner', function(job, $done) {
  console.log('SHINER SHINER SHINER')
  $done()
})

d2.speaks('http')

d2.start(function(err) {
  d2.jobs.push('shinerdog', {}, function() {
    console.log('-----')
  })
})


