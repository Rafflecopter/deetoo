var raven = require('raven')
,   _errlog

,sentry_capture = function() {
    if (this.level < 2) {
        if (_errlog) {
            _errlog.captureError(new Error(this.message))
        } else {
            console.error(this)
        }
    }
}

module.exports = function(config) {
    if (!_errlog && config.sentry)
        _errlog = new raven.Client(config.sentry);
    return sentry_capture
}

