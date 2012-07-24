// We need this to build our post string
var assert = require('assert');
var http = require('http');
var default_config = require('./config_default');

var CONF = {
     host: 'localhost'
    ,port: default_config.port_www.toString()
    ,path: '/api/v1/shiner/'+Math.round(Math.random()*1000000)+'/'
    ,auth: default_config.auth
}

function testPushTask($done) {
    // Build the post string from an object
    var post_data = JSON.stringify({
        'data': {
            'title': 'job example for shiner task',
        },
        'when' : ((new Date()).getTime() + 30000).toString(),
    });

    // An object of options to indicate where to post to
    var post_options = {
        host: CONF.host,
        port: CONF.port,
        path: CONF.path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': post_data.length,
            'authorization': 'Basic ' + new Buffer(CONF.auth.user+':'+CONF.auth.pass).toString('base64')
        }
    };

    // Set up the request
    var post_req = http.request(post_options, $done);

    // post the data
    post_req.write(post_data);
    post_req.end();

}
function testDeleteTask($done) {
    // An object of options to indicate where to post to
    var post_options = {
        host: CONF.host,
        port: CONF.port,
        path: CONF.path,
        method: 'DELETE',
        headers: {
            'authorization': 'Basic ' + new Buffer(CONF.auth.user+':'+CONF.auth.pass).toString('base64')
        }
    };

    // Set up the request
    var post_req = http.request(post_options, $done);

    // post the data
    post_req.write(JSON.stringify({}));
    post_req.end();

}

testPushTask(function(res) {
    assert.strictEqual(res.statusCode, 200, "Job was NOT queued succesfully. Response code: " + res.statusCode)
    console.log('Pushed task to Shiner...')

    setTimeout(function() {
        testDeleteTask(function(res) {
            assert.strictEqual(res.statusCode, 200, "Job was NOT deleted succesfully. Response code: " + res.statusCode)
            console.log('Trying to delete task from queue...Response: '+res.statusCode)
        })
    }, 10000)
})

