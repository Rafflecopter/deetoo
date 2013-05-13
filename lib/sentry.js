var raven = require('raven')
,   _errlog

,sentry_capture = function(err) {
    if (this.level < 2) {
        if (_errlog && err && err instanceof Error) {
            _errlog.captureError(err)
        } else {
            console.error(this)
        }
    }
}

module.exports = function(sentryDSN) {
    if (!_errlog && sentryDSN)
        _errlog = new raven.Client(sentryDSN);
    return sentry_capture
}

