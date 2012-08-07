var SECONDS = 1000
,   MINUTES = 60 * SECONDS

module.exports = {
     port_www:  8888

    ,sigterm_shutdown_timeout: 10 * SECONDS
    
    ,garbage_collect: {
        outfile: function(job) {
            return ['/tmp/deetoo-gcdump-', job.type, 'UTC'].join('')
        }
    }
}

