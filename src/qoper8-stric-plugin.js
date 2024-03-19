/*
 ----------------------------------------------------------------------------
 | QOper8-Stric-Plugin: Stric Plugin for dispatching requests to WebWorker   |
 |                                                                           |
 | Copyright (c) 2023-24 MGateway Ltd,                                       |
 | Redhill, Surrey UK.                                                       |
 | All rights reserved.                                                      |
 |                                                                           |
 | https://www.mgateway.com                                                  |
 | Email: rtweed@mgateway.com                                                |
 |                                                                           |
 |                                                                           |
 | Licensed under the Apache License, Version 2.0 (the "License");           |
 | you may not use this file except in compliance with the License.          |
 | You may obtain a copy of the License at                                   |
 |                                                                           |
 |     http://www.apache.org/licenses/LICENSE-2.0                            |
 |                                                                           |
 | Unless required by applicable law or agreed to in writing, software       |
 | distributed under the License is distributed on an "AS IS" BASIS,         |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  |
 | See the License for the specific language governing permissions and       |
 |  limitations under the License.                                           |
 ----------------------------------------------------------------------------

19 March 2024

*/

import {query as parse} from '@stricjs/utils';
import {URL} from 'url';
import crypto from 'crypto';

async function QOper8_Plugin (router, options) {

  let qmodule;
  options.exitOnStop = true;

  let mode = options.mode || 'webworker';
  if (mode === 'child_process') {
    qmodule = await import('qoper8-cp');
  }
  else if (mode === 'webworker') {
    qmodule = await import('qoper8-ww');
  } 
  else {
    qmodule = await import('qoper8-wt');
  }

  const qoper8 = new qmodule.QOper8(options);

  qoper8.routeToName = new Map();
  for (let route of options.workerHandlersByRoute) {
    let name = crypto.createHash('sha1').update(route.url).digest('hex');
    if (mode === 'webworker') {
      qoper8.handlersByMessageType.set(name, route.handlerPath);
    }
    else {
      qoper8.handlersByMessageType.set(name, {module: route.handlerPath});
    }

    router[route.method](route.url, async (ctx) => {
      let url = new URL(ctx.req.url);

      let body;
      if (ctx.req.method === 'POST' || ctx.req.method === 'PUT' || ctx.req.method === 'PATCH') {
        try {
          body = await ctx.req.json();
        }
        catch(err) {
        }
      }

      let qRequest = {
        method: ctx.req.method,
        body: body,
        headers: Object.fromEntries(ctx.req.headers.entries()),
        url: ctx.req.url,
        hostname: url.hostname,
        protocol: url.protocol,
        params: ctx.params,
        query: Object.fromEntries(url.searchParams.entries()),
        routerPath: route.url
      };

      let res = await qoper8.send({
        type: name,
        data: qRequest
      });
      delete res.qoper8;

      if (res.error) {
        let status = 400;
        if (res.errorCode) {
          status = res.errorCode;
          delete res.errorCode;
        }
        return Response.json(res, {status: status});
      }
      else {
        let options;
        if (res.http_response) {
          if (res.http_response.statusCode) {
            options = {status: res.http_response.statusCode}
          }
          if (res.http_response.headers) {
            if (!options) options = {};
            options.headers = res.http_response.headers;
          }
          delete res.http_response;
        }
        return Response.json(res, options);
      }
    });
  }

  return qoper8;

};

export {QOper8_Plugin};
