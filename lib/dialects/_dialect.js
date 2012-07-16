
var _ = require('underscore')

module.exports = {
  allowJobType: function(jobType) {
    if (! _.isArray(jobType))
      jobType = [jobType];

    this._allowedJobTypes = this._allowedJobTypes || []
    this._allowedJobTypes.concat(jobType)
  }
}


