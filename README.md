DeeToo
======

DeeToo makes it dead-simple to write service-providing workers in Node.js

With minimal boilerplate, you get a fast, reliable server that provides a service (or group of services) to the rest of your infrastructure. When we say minimal boilerplate, we mean it. Here's a worker that knows how to "email" and provides a public HTTP API for pushing jobs, an admin dashboard and more:

```javascript
// "sendEmail" is your function to send emails
var d2 = require('DeeToo').init();
d2.can('email', sendEmail).speaks('http').start();
```

_(pro tip: check out [DeeToo Skeleton](https://github.com/Rafflecopter/deetoo_skeleton))_

You could use DeeToo for email sending, report generation, rendering, backups, etc... At [Rafflecopter](http://www.rafflecopter.com), we use it for almost everything.

It features these awesome things, right out of the box:
* Multi-protocol, authenticated API
* Admin dashboard
* Schedule jobs for later, update them before they're processed
* Graceful shutdown for easy [re-]deployments
* Garbage collection
* Extensible logging
* _More awesomeness is coming! See [TODO](#todo)_

<br/><hr/><br/>
## Yeah, whatever. Tell me how to use it.

__tl;dr: [Read the example file](https://github.com/Rafflecopter/deetoo/blob/master/test/example.js)__

The atomic unit of work in DeeToo is a `Job`. You tell DeeToo how to perform a certain type of job, and DeeToo provides an interface for your application, so other services can send jobs to it.

DeeToo is based on a [job queue](http://en.wikipedia.org/wiki/Job_queue) (specifically [Kue](https://github.com/LearnBoost/kue), via [Redis](http://redis.io/)) - to have DeeToo perform a task, you simply push a job into the queue. DeeToo will process the job as fast as it can (or wait until a certain time, optionally)

DeeToo provides some core functions, which we'll discuss in detail:

__DeeToo Module__ (ie. `require('deetoo')`)
* `.init ([config])` -- returns the DeeToo singleton object

__DeeToo Object__
* `.can (jobType, [concurrency], callback)`
* `.speaks (dialect, [dialect], [...])`
* `.start ([callback])`
* `.shutdown ([timeout], [deaf], callback)`

### What is a Job?

A job is simply a packaged set of information that your service needs to process a specific job. It's an object that contains these fields:
* `jobType` - what type of job is this (ie. "email", "cohort-report", "csv-export", etc...)
* `jobData` - data specific to this job (ie. "to_address", "subject", etc...)
* `[when]` - _optional_ - A UTC timestamp (in milliseconds) when the job should be run
* `[id]` - _optional_ - if you give a scheduled Job (one w/ a `when`) an ID, you can change it before it's processed

For example, here's a job for a "subscription expiring" email to be sent @ midnight MST on 11/31/2012:
```json
{
  "jobType": "email",
  "jobData": {
    "to_addr": "c3po@rebelalliance.com",
    "template": "subscription-expiring",
    "subject": "Your subscription is expiring soon!",
    "auto_renew": false
  },
  "when": 1356937200000,
  "id": "subren-c3po"
}
```

### How do I get Jobs in the queue?
You can push a job to DeeToo in one of 2 ways: use the worker's public API, or push a job from w/in your code.

#### Using the API
DeeToo can speak any protocol, but ships w/ HTTP by default. Use it like this:

```
POST /api/v2/<job_type>
```
The POST body should be a JSON-encoded object, containing a `.jobData` property, and (optionally) a `.when` & `.id`

#### From w/in your code:
If you want to push a job from w/in the worker itself, you can use:

```javascript
d2.jobs.push(job, callback)
```

`job` is an object containing the fields detailed above. `callback` is an optional callback that's called after the job is pushed into the queue.

#### You said I could schedule jobs, and update them later?
Yep! Just include a `when` and an `id` in your job. If a job w/ that `id` is already queued, it will be replaced w/ when a new job w/ the same `id` is pushed. Simple!


### How do I process jobs from the queue?

That's what ```d2.can()``` is for. Here's how it works:

```javascript
function beABoss(job, $done) {
  console.log(job.data.what_im_doing + " LIKE A BOSS!")
  $done()
}

d2.can('be-a-boss', beABoss)
```

You can access your job-specific data from `job.data`

`job` can do some other useful things, like update its own progress (which will be displayed on the admin dashboard). To do that, use `job.progress(currentFrame, totalFrames)` -- for more about using `job`, see [Kue's README](https://github.com/LearnBoost/kue#updating-progress)

You can optionally pass a `concurrency` parameter, which means DeeToo can process that many jobs at once. For low-CPU jobs (like sending email), set this high for a big potential speedup. For high-CPU (blocking) jobs, this won't help much. Note that this _does **not**_ spawn child processes. It simply runs the jobs in parallel on one process. Example:

```javascript
d2.can('be-a-boss', 12, beABoss)
```


<br/><hr/><br/>
## Starting Up and Shutting Down

### Starting Up
DeeToo is a standalone server, at least providing an admin-facing dashboard via HTTP. To start it, simply do:

```javascript
d2.start(function() {
  console.log('Up and running, LIKE A BOSS!')
})
```

### Shutting Down
One of DeeToo's strengths is that it knows how to shut itself down gently, without canceling jobs that are in-progress, or corrupting any data. Here's how to shut it down:

```javascript
d2.shutdown(function() {
  console.log('All in-progress jobs have finished running. We are shut down!')
  process.exit(0)
})
```

By default, `.shutdown()` only stops processing jobs. It will keep the service available by listening for incoming requests and queuing them. __This is usually desired behavior!__ If you want to stop listening for incoming requests without calling `process.exit`, you can pass an optional `deaf` argument, like so:

```javascript
d2.shutdown(true, function() {
  console.log('All in-progress jobs have completed.\n',
              'All listeners have stopped listening.\n',
              'DeeToo is completely shut down.')
})
```

By default, DeeToo will only shut down after all in-progress jobs have finished running. __This is usually desired behavior!__ However, sometimes there's a limit on how long you can wait. In those cases, you can use the optional `timeout` parameter:

```javascript
d2.shutdown(10000, function() {   // wait at most 10 seconds
  console.log('All in-progress jobs have either finished, or timed out.')
})
```

If a timeout occurs, any in-progress jobs will be marked as `failed` and will need to be restarted by hand. `TODO: there are better ways to handle this, ie. retries`

You can use both optional arguments together:

```javascript
d2.shutdown(10000, true, function() {
  console.log('DeeToo is shut down.')
})
```

#### SIGTERM

DeeToo will begin the shutdown process when it receives a `SIGTERM`. This is not optional (yet).

<br/><hr/><br/>

## Auxiliary things

You can access the raw Kue instance via `d2.jobs._rawQueue`

You can access DeeToo's logger via `d2.log`. To learn how to use it, see the [node-book](https://github.com/shtylman/node-book) project.

DeeToo shares some of the things it uses, so you can use them, too. They're accessed via `d2._`
* `d2._.www` - the [Express](https://github.com/visionmedia/express) server
* `d2._.redis` - the connected redis client

<br/><hr/><br/>

## Configuration Options

DeeToo offers a number of configuration options. Set config options by passing an object to `.init()` when you first import the module. Defaults are subject to wild change, for now.

__port_www__ - what port should HTTP listen to? -- `default: 8888`

__garbage_collect__ - remove jobs from Redis after completion? (saves RAM) -- `default: true`

__sigterm_shutdown_timeout__ - timeout SIGTERM will pass to `.shutdown()` -- `default: 5 minutes`

__auth__ - use HTTP authentication to secure admin UI and job API -- `default: undefined`
* If defined, should be an object containing `user` & `pass` properties

__redis__ - where to find Redis and how to authenticate -- `default: localhost, default port, no authentication`
* If defined, should be an object containing `host`, `port`, & `pass` properties


<br/><hr/><br/>

## How do I make it speak another protocol?
_DOCUMENTATION COMING SOON_

<br/><hr/><br/>

## TODO
* Add [Cluster](http://nodejs.org/api/cluster.html) for better CPU utilization on multicore machines
* Add other dialects besides HTTP (eyeing [Axon](https://github.com/visionmedia/axon), 0mq, and raw TCP)
* Add documentation about memory leak detection


        
                     ______             
                  ,-'//__\\`-.          
                ,'  ____      `.        
               /   / ,-.-.      \       
              (/# /__`-'_| || || )      
              ||# []/()] O || || |      
            __`------------------'__    
           |--| |<=={_______}=|| |--|   
           |  | |-------------|| |  |   
           |  | |={_______}==>|| |  |   
           |  | |   |: _ :|   || |  |   
           > _| |___|:===:|   || |__<   
           :| | __| |: - :|   || | |:   
           :| | ==| |: _ :|   || | |:   
           :| | ==|_|:===:|___||_| |:   
           :| |___|_|:___:|___||_| |:   
           :| |||   ||/_\|| ||| -| |:   
           ;I_|||[]_||\_/|| ||| -|_I;   
           |_ |__________________| _|   
           | `\\\___|____|____/_//' |   
           J : |     \____/     | : L   
          _|_: |      |__|      | :_|_  
        -/ _-_.'    -/    \-    `.-_- \-
        /______\    /______\    /______\

