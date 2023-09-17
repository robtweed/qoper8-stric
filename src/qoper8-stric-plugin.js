/*
 ----------------------------------------------------------------------------
 | QOper8-Stric-Plugin: Stric Plugin for dispatching requests to WebWorker   |
 |                                                                           |
 | Copyright (c) 2023 MGateway Ltd,                                          |
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

17 September 2023

*/

import {query as parse} from '@stricjs/utils';
import {URL} from 'url';
import crypto from 'crypto';
import {QOper8} from 'qoper8-ww';

function QOper8_Plugin (router, options) {

  const qoper8 = new QOper8(options);

  qoper8.routeToName = new Map();
  for (let route of options.workerHandlersByRoute) {
    let name = crypto.createHash('sha1').update(route.url).digest('hex');
    qoper8.handlersByMessageType.set(name, route.handlerPath);

    router[route.method](route.url, async (req) => {
      let url = new URL(req.url);
      let qRequest = {
        method: req.method,
        body: req.data,
        headers: Object.fromEntries(req.headers.entries()),
        url: url.pathname,
        hostname: url.hostname,
        protocol: url.protocol,
        query: {},
        params: req.params,
        routerPath: route.url
      };
      if (req.query !== -1) qRequest.query = parse(req.url.substring(req.query + 1));

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

};

export {QOper8_Plugin};
