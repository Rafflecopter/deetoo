var CONF = {
  memChecker: {
    memLimit: 50
  }
}

var d2 = require('..').init(CONF)
d2.speaks('http').can('test', function(f){f()}).start()

var LEAK = []

//setInterval(function() {
  //for (var i = 0; i < 100000; i++) {
    //LEAK.push('shiner is a dog')
  //}
//}, 1000)

/*
 * stdout should look something like this:
 * 

[info]   Admin UI running on :8888
[info]  ([> DeeToo has started listening & processing jobs <])
[info]  Memory usage is OK @ 39mb / 50 mb. Still alive...
[info]  Memory usage is OK @ 46mb / 50 mb. Still alive...
[info]  Memory limit exceeded @ 53 MB. Shutting down!
[info]  ([> Shutting down when all active jobs have finished... <])
[info]  ([> All active jobs have completed. DeeToo is NOT processing jobs. <])
[info]  ([> Shutting down all listeners... <])
[info]  ([> All listeners have stopped listening. <])
[info]  Shutdown triggered by memory limit breach is now complete

 */
