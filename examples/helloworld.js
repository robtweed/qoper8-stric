const handler = function(messageObj, finished) {

  // process the incoming message object


  // on completion, invoke the QOper8 finished() method
  //  to return the response and release the Worker back
  //  to the available pool


  // Create an error if ?a=error added to request URL

  if (messageObj.data.query && messageObj.data.query.a === 'error') {
    return finished({error: 'test error', errorCode: 403});
  }

  finished({
    ok: true,
    hello: 'world'
  });

};

export {handler};