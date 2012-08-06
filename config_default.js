var SECONDS = 1000
,   MINUTES = 60 * SECONDS

module.exports = {
     port_www:  8888
    
    ,garbage_collect: {
        outfile: function(job) {
            return ['/tmp/deetoo-gcdump-', job.type, 'UTC'].join('')
        }
    }
}

