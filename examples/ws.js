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
    },
    {
      method: 'get',
      url: '/user/:userId',
      handlerPath: 'user.js'
    }
  ]
}

QOper8_Plugin(router, options);

router.use(404, (req) => {
  return Response.json({error: 'Unrecognised request'}, {status: 401});
});

export default router;

