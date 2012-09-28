
var kue = require('kue')
,   jobs= kue.createQueue()

,   i = 1

kue.app.listen(3000)

jobs.process('shiner', 3, function(job, $done) {
    console.log('starting ' + job.data.title)
    setTimeout(function() {
        console.log('finished ' + job.data.title)
        $done()
    }, 1000)
})

jobs.on('error', function(err) {
    console.log('EMITTED - ' + err)
})

//for (var j=0; j<12; j++) {
    //console.log('creating #' + j)
    //jobs.create('shiner', {title:'testing ' + j}).save()
//}


//setTimeout(function() {
    //console.log('shutting down...')
    //jobs.shutdown(function(){console.log('SHUT DOWN');process.exit(0)})
//}, 2300)

