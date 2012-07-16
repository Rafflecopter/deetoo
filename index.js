
var emailTemplates = require('email-templates')
,   deetoo = require('deetoo')
,   async = require('async')
,   _ = require('underscore')

,   TEMPLATE

,   d2 = new deetoo()


function SETUP($done) {
    var _tplCompile = _.bind(emailTemplates, {}, config.tplDir)

    ,   _tplCache = function(err, t, $done) {
            if (!err) TEMPLATE = template;
            $done(err)
        }

    async.waterfall([_tplCompile, _tplCache], $done)
}

function _job_title(job) {
    return [job.template, job.to].join(' for ')
}

function createEmail(job, $done) {
    function _rendered(err, html, text) {
        var email = {
             from: config.email.from
            ,to: job.data.to
            ,subject: config.subjects[job.data.template]
            ,html: html
            ,text: text
        }

        $done(err, email)
    }

    if (err) {  // do something
    }
    
    TEMPLATE(job.data.template, job.data.context, _rendered)
}


d2.can('email', function(job, $done) {
    // called by kue when a job is to be processed
    createEmail(job, function(err, email) {
        if (err) return $done(err);
        transport.sendMail(email, $done)
    })
})

d2.preprocess('email', function(jobData, $done) {
    jobData.title = _job_title(jobData)
    return jobData
})


d2.Q.on('job failed', function(){})


d2.speaks('http')


d2.start(SETUP, function(setupErr) {
    if (setupErr)
        console.log('ERR!');

    console.log('In ur emailz, sendin them...')
})



