
var _ = require('underscore')

module.exports = {
  allowJobType: function(jobType) {
    if (! _.isArray(jobType))
      jobType = [jobType];

    //console.log('allowing', jobType)
    this._allowedJobTypes = this._allowedJobTypes || []
    this._allowedJobTypes.concat(jobType)
  }

  ,shutdown: function($done) {
    $done("Dialects should implement their own shutdown()!")
  }
}


