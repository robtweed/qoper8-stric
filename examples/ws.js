import { Router } from '@stricjs/router';
import {QOper8_Plugin} from 'qoper8-stric';

let router =  new Router({port: 3000});

// Create 2 routes that will be handled by a pool of two Child Process workers

const options = {
  mode: 'child_process',
  logging: true,
  poolSize: 2,
  exitOnStop: true,
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

let qoper8 = await QOper8_Plugin(router, options);

let counts = {};

qoper8.on('workerStarted', function(id) {
  console.log('worker ' + id + ' started');
});

qoper8.on('workerStopped', function(id) {
  console.log('worker ' + id + ' stopped');
  delete counts[id];
});

qoper8.on('replyReceived', function(res) {
  let id = res.workerId;
  if (!counts[id]) counts[id] = 0;
  counts[id]++;
});

let countTimer = setInterval(() => {
  console.log('messages handled:');
  for (let id in counts) {
    console.log(id + ': ' + counts[id]);
  }
  console.log('-----');
}, 20000);

qoper8.on('stop', () => {
  clearInterval(countTimer);
});

router.use(404, (req) => {
  return Response.json({error: 'Unrecognised request'}, {status: 401});
});

export default router;

