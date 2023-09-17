# qoper8-stric: QOper8 Plugin for the Bun.js Stric Web Framework
 
Rob Tweed <rtweed@mgateway.com>  
17 September 2023, MGateway Ltd [https://www.mgateway.com](https://www.mgateway.com)  

Twitter: @rtweed

Google Group for discussions, support, advice etc: [http://groups.google.co.uk/group/enterprise-web-developer-community](http://groups.google.co.uk/group/enterprise-web-developer-community)


## Background

*qoper8-stric* is a Plugin for [Stric](https://stricjs.netlify.app),
the extremely high-performance Web Framework that has been specifically written for the Bun.js Runtime.

*qoper8-stric* integrates the 
[*QOper8*](https://github.com/robtweed/qoper8-ww) Module with Stric, to allow handling of incoming
requests by a pool of WebWorker threads.

When using *QOper8*, messages are placed in a queue, from where they are dispatched to an available
WebWorker and handled by a module of your choice.  

This queue-based design creates a highly-scalable architecture for handling a large amount of messages, particularly if some require significant CPU resources, since the load imposed by handling the messages is off-loaded to a 
WebWorker, Worker Thread or Child Process.  An interesting aspect of *QOper8* is that each WebWorker only handles a single message at a time, meaning that within the WebWorker, concurrency is not an issue.  *qoper8-stric* Handlers can therefore safely use synchronous APIs if required.

The *QOper8* module itself is extremely fast: benchmarks on a standard M1 Mac Mini have shown that *QOper8*'s
throughput can exceed 160,000 messages/second when used with a pool of 8 WebWorkers.


## API Handling

*qoper8-stric* does not limit you to handling all requests in WebWorkers.

You can use all of Stric's other functionality, so you can have a mixture of:

- API routes that are handled by Stric in the main thread as normal
- API routes that are handled within a WebWorker


## Installing *qoper8-stric*

        bun install qoper8-stric

Installing *qoper8-stric* will also install the following as dependencies:

  - @stricjs/utils
  - qoper8-ww


## Configuring Stric to Use *qoper8-stric*

*qoper8-stric* is implemented as a Plug-in.  To configure it for use with Stric:

- First, import the Stric Router module and *qoper8-stric*, and instantiate the Stric Router, eg:

        import { Router } from '@stricjs/router';
        import {QOper8_Plugin} from 'qoper8-stric';
        
        let router =  new Router();

- Next, determine any QOper8 startup options, such as:

  - the Worker pool size (defaults to 1)
  - whether or not you want the QOoper8 module to log its activity to the console (which is recommended during development)

        const options = {
          logging: true,            // defaults to false if not specified
          poolSize: 3               // we will use up to 3 Workers, depending on activity levels 
        }


Full details of the startup options for 
[QOper8 are available here](https://github.com/robtweed/QOper8#startingconfiguring-qoper8)


- You can now invoke the *qoper8-stric* Plugin:


        QOper8_Plugin(router, options);


## Handling Incoming Requests within QOper8 WebWorkers


The steps shown above will not actually route any incoming HTTP requests to a WebWorker.  To do that,
you need to specify the API routes and their associated Worker Handler modules in the *options* object.
Worker Handlers are specified by adding an array named *workerHandlersByRoute*.

Each element of the *workerHandlersByRoute* array is an object that specifies three properties:

- method: get, post, etc
- url: the API URL route, eg /myapi
- handlerPath: the file path for of the handler module file.  Note that the path you specify will be relative 
to the directory in which you started your Bun script.

For example, suppose you want the API -  *GET /helloworld* - to be handled in a Worker using a
module named *helloworld.js*, you would change the *options* object to:


        const options = {
          logging: true,
          poolSize: 3,
          workerHandlersByRoute: [
            {
              method: 'get',
              url: '/helloworld',
              handlerPath: 'helloWorld.js'
            }
          ]
        }



As a result of the steps shown above, the *qoper8-stric* PlugIn will automatically use *QOper8* 
to route all incoming instances of *GET /helloworld* to a WebWorker, where they will be handled by your 
*helloworld.js* module.

*qoper8-stric* generates the associated Stric Router functions automatically for you from the information 
you supply in the *workerHandlersByRoute* array.


## Handler Modules

### Structure/Pattern

*QOper8* WebWorker Message Handler Modules must export a function with two arguments:

- *messageObj*: the incoming HTTP request, as repackaged for you by *qoper8-stric*

- *finished*: the method provided by *QOper8* that you must use for returning your response object and releasing the Worker back to the available pool

The export must be to *{handler}*.

For example:

        const handler = function(messageObj, finished) {

          // process the incoming message object


          // on completion, invoke the QOper8 finished() method
          //  to return the response and release the Worker back
          //  to the available pool

          finished({
            ok: true,
            hello: 'world'
          });
        };

        export {handler};


For more details about QOper8 handler modules, see the 
[relevant documentation](https://github.com/robtweed/QOper8#the-message-handler-method-script)


#### The Repackaged HTTP Request in *messageObj*

The *messageObj* argument contains the re-packaged incoming HTTP request.  It is a simple object with the following structure.  The *data* sub-object is created from the corresponding incoming Stric Request object and 
the Request URL as shown:

        {
          type: message_type,
          data: {
            method: req.method,
            query: req.query,
            body: req.body,
            params: req.params,
            headers: req.headers,
            hostname: url.hostname,
            protocol: url.protocol,
            url: url.pathname,
            routerPath: // from your router URL
          }
        }

where *message_type* is an internally-used opaque, unique message type name created automatically by 
*qoper8-stric* for this particular route.

For example:

        {
          "type": "f9862f0ed8f093afb7f6d2165aa63a69dda262da",
          "data": {
            "method": "GET",
            "query": {},
            "params": {},
            "headers": {
              "host": "127.0.0.1:3000",
              "user-agent": "curl/7.74.0",
              "accept": "*/*"
            },
            "ip": "127.0.0.1",
            "hostname": "127.0.0.1:3000",
            "protocol": "http",
            "url": "/user/rob",
            "routerPath": "/user/:userId"
        }


*messageObj* will therefore contain all the information you need in order to process the incoming instance of 
each of the API you need to handle.  For *POST* methods, most of the information you'll require will be in
*messageObj.data.body*, and for *GET* methods you'll probably mainly use *messageObj.data.query* and/or
 *messageObj.data.params*


## Initialising/Customising the Worker

You may need to customise the Worker environment and the *this* context of the Worker.  For example you may want each Worker to connect to a database when it first starts, and provide the access credentials for the database via the Worker's *this* context.

You do this via an additional property - *onStartup* - in the *options* object, eg:

        onStartup: {
          module: 'myStartupModule.js'
        }


Note that, just like Handler Modules, the path you specify for a startup module will be relative 
to the directory in which you started your Bun script

For full details about QOper8 Worker Startup Modules, see the 
[relevant documentation](https://github.com/robtweed/QOper8#optional-webworker-initialisationcustomisation)


----

## Worked Example Integrating QOper8 with *qoper8-stric*


### main.js


        import { Router } from '@stricjs/router';
        import {QOper8_Plugin} from 'qoper8-stric';

        let router =  new Router({port: 3000});

        // Create 2 routes that will be handled in a WebWorker

        const options = {
          logging: false,
          poolSize: 2,
          workerHandlersByRoute: [
            {
              method: 'get',
              url: '/helloworld',
              handlerPath: 'helloWorld.js'
            }
          ]
        }

        QOper8_Plugin(router, options);

        router.use(404, (req) => {
          return Response.json({error: 'Unrecognised request'}, {status: 401});
        });

        export default router;


### helloWorld.js


        const handler = function(messageObj, finished) {
       
          // process incoming request in messageObj.data

          // return response - contents are for you to determine

          finished({
            ok: true,
            hello: 'world'
          });
        };

        export {handler};



----

## Handling Dynamic URLs

Stric allows you to declare wildcards and parameters in URLs, and you can use these in routes
you specify for handling in a Worker, eg;

          workerHandlersByRoute: [
            {
              method: 'get',
              url: '/example/:userId',
              handlerPath: 'handlers/getUser.js'
            },
            {
              method: 'get',
              url: '/example/:userId/:token',
              handlerPath: 'handlers/getUserToken.js'
            },
            {
              method: 'get',
              url: '/example/any/*',
              handlerPath: 'handlers/getAny.js'
            }
          ]


If an incoming request matches any of the parametric or wildcard routes, it will be routed to a Worker
and the specified Handler Module will be applied.

The specific incoming values of parameters or a wildcard are accessed via the *messageObj.data.params* object
within your Handler module, eg:

### getUserToken.js


        const handler = function(messageObj, finished) {
       
          let userId = messageObj.data.params.userId;
          let token = messageObj.data.params.token;

          // etc...

          if (invalidUser) {
            finished({
              error: 'Invalid User'
            });
          }
          else {
            finished({
              ok: true,
            });
          }
        };

        export {handler};

----

## Handling Errors

You can return an error from your Handler Module simply by returning an *error* property via the *finished()*
method, eg:

            return finished({
              error: 'Invalid User'
            });

*qoper8-stric* will automatically change the HTTP response status to 400.

You can customise the HTTP response status by adding an *errorCode* property, eg:

            return finished({
              error: 'Invalid User',
              errorCode: 405
            });

*qoper8-stric* removes the *errorCode* property from the response object that is sent to the client, but
changes the HTTP status code of the response.


----

## Customising the Response Headers

*qoper8-stric* also allows you to optionally modify the HTTP response status code and headers, just before
 the Response is sent back to the client. 

You do this via the reserved *http_response* property that you can optionally add to your *finished()* object
within your Message Handler(s).

For example:


      finished({
        ok: true,
        hello: 'world',

        http_response: {
          statusCode: 201,
          headers: {
            authorization: 'mySecretCredential'
          }
        }

      });



## License

 Copyright (c) 2023 MGateway Ltd,                           
 Redhill, Surrey UK.                                                      
 All rights reserved.                                                     
                                                                           
  https://www.mgateway.com                                                  
  Email: rtweed@mgateway.com                                               
                                                                           
                                                                           
  Licensed under the Apache License, Version 2.0 (the "License");          
  you may not use this file except in compliance with the License.         
  You may obtain a copy of the License at                                  
                                                                           
      http://www.apache.org/licenses/LICENSE-2.0                           
                                                                           
  Unless required by applicable law or agreed to in writing, software      
  distributed under the License is distributed on an "AS IS" BASIS,        
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
  See the License for the specific language governing permissions and      
   limitations under the License.      
