var _ = require('underscore')

var DEFAULTS = {
   memLimit: 100 // MB
  ,tickInterval: 3 // seconds
}


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// MemChecker class
//
// TODO: would be nice to print out some statistics, and have 
//       something like memwatch available via an ENV var toggle
//       (ie. passing it as an option)

function MemChecker(d2, options) {
  this.d2 = d2
  this.log = this.d2.log.info.bind(this.d2.log)
  this.options = _.extend({}, DEFAULTS, options)

  setInterval(this.tick.bind(this), this.options.tickInterval * 1000)
}


MemChecker.prototype.tick = function() {
  var limit = this.options.memLimit * 1024 * 1024 // MB -> bytes
    , curMem = process.memoryUsage().rss
    , memDisplay = Math.round(curMem / (1024 * 1024))

  if (curMem < limit) {
    this.log("Memory usage is OK @ " + memDisplay + 
             "mb / " + this.options.memLimit + " mb. Still alive...")
    return
  }

  this.log("Memory limit exceeded @ " + memDisplay + 
           " MB. Shutting down!")

  this.exit()
}

MemChecker.prototype.exit = function(force) {
  var self = this
  this.d2.shutdown(true, true, function(err) {
    self.log("Shutdown triggered by memory limit breach is now complete")
    if (err) self.log("... with error: ", err);
    process.exit(1)
  })
}


module.exports = exports = MemChecker

