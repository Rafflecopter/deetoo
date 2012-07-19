var raven = require('raven')
,   CONF = require('../config_default')
,   sentry_capture

if (CONF.sentry) {
    _errlog = new raven.Client(CONF.sentry)
    sentry_capture = function() {
        var entry = this;
        if (entry.level < 2) {
            _errlog.captureError(entry.message)
        }
    }
} else {
    sentry_capture = function() {};
}

module.exports = sentry_capture
