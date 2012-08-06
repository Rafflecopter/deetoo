deetoo
======

_Disclaimer: DEETOO IS VERY MUCH A WORK-IN-PROGRESS._

DeeToo is a multi-purpose astromech droid (ie. a job-processing worker for Node.js that's backed by [Kue](https://github.com/LearnBoost/kue))

DeeToo is written in javascript but can be used from any language. It's made to be extremely performant, and _insanely_ easy to use & deploy. 

```javascript
var d2 = require('deetoo').init()
d2.can('convert video', myConversionFunc).start()
```


## What do it do?

It features some cool things right out the box:
* Public (authenticated) API for creating jobs. Create jobs in any language!
* Schedule jobs to happen in the future, and easily update them before they're processed.
* Optional garbage collection (purge finished jobs for minimal memory usage)
* Graceful shutdown for seamless [re-]deployments
* Purdy browser-based admin UI
* Extensible logging
* _More awesomeness is coming! See [TODO](#todo)_


## How do I use it?

### Import it
DeeToo works as a singleton. To get an instance of the object (or create it initially), do this:

```javascript
var d2 = require('deetoo').init()
```

### Start it
DeeToo exposes 4 core methods:
* **.can(jobType, [numConcurrent], proc)** - associate a processing function w/ a job type
    * `jobType`: Type of job to process (ex: "email", "video conversion", etc...)
    * `[numConcurrent]`: *optional* How many jobs of this type can we handle at once?
    * `proc` - your processing function to handle jobs of `jobType`

* **.speaks(dialect)** - expose API to a new protocol
    * `dialect` - Name of a dialect plugin
    * _By default, DeeToo speaks HTTP. You don't need to call this function at all, unless you're using a custom dialect._

* **.start([callback])** - Begin processing queue'd jobs and listening for incoming requests
    * `[callback]` - *optional* A function to be called once DeeToo has finished "booting up"

* **.shutdown([timeout], callback)** - Shuts down DeeToo after all in-progress jobs have completed
    * `[timeout]` - *optional* Only wait this many milliseconds before shutting down. 
        * After `timeout`, any jobs still in-progress will be marked 'failed'. You can view them in the Admin UI.
    * `callback` - A function to be called after DeeToo has completely shut down.


### Push a new job

A DeeToo job is an object w/ these properties:
* `jobType` - type of job (ie. "email", "video conversion", etc...)
* `jobData` - an object of custom data your job needs (ie. email_address, subject, etc...). 
    * If you include a `title` property, it will be displayed in the Admin UI.
* `[id]` - _optional_ A ID for the job that can be used to refer to it (update/remove) later
* `[when]` - _optional_ A UTC timestamp (in milliseconds) specifying the date/time the job should be run.
    * _DeeToo "promotes" scheduled jobs every 5 seconds, so you're limited to 5-second granularity. This will likely change in the future._

There are a couple of ways to create a new job:
* DeeToo's public API:
    * **HTTP dialect**: Send a `POST` to `/api/v1/<job_type>/<id>`
        * POST body should be a JSON-encoded object w/ a `.jobData` property and, optionally, `.when`
* W/in your code: `d2.jobs.push(envelope, callback)`
    * `envelope` is an object containing the above fields
    * `callback` will be called when the job has been pushed to the queue


## How do I make it speak another protocol?
_DOCUMENTATION COMING SOON_

## TODO
* Add Cluster for better CPU utilization on multicore machines
* Add other dialects besides HTTP (eyeing [Axon](https://github.com/visionmedia/axon), 0mq, and raw TCP)
* Better logging


        
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
        
