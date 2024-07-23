const handler = function(messageObj, finished) {

  if (!messageObj.data.params) {
    return finished({error: 'Invalid Request'});
  }

  if (messageObj.data.params.userId !== 'rob') {
    return finished({error: 'Invalid User'});
  }

  finished({
    userId: messageObj.data.params.userId
  });

};

export {handler};