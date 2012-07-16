
var DeeToo = require('./lib/deetoo')

,   d2 = new DeeToo()


d2.can('shiner', function(job, $done) {
  console.log('SHINER SHINER SHINER')
  $done()
})

d2.speaks('http')

d2.start(function(err) {
  console.log('pushing sample job w/ timestamp id...')
  d2.jobs.push('shiner', ''+(+new Date), {title:(+new Date)}, function(err) {
    if (err)
      return console.log('ERROR! - ' + err);
    console.log('JOB SAVED')
  })
})


