var SECONDS = 1000
,   MINUTES = 60 * SECONDS

module.exports = {
     port_www:  8888
    ,sigterm_shutdown_timeout: 5 * MINUTES
    ,garbage_collect: true
    ,admin_url_prefix: 'd2'
    ,rss_threshold: 128e6
}

