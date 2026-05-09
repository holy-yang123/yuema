const request = require('../utils/request');

module.exports = {
  list(roomId, before, limit) {
    const q = { roomId };
    if (before) {
      q.before = before;
    }
    if (limit) {
      q.limit = limit;
    }
    return request.get('/chat/list', q);
  }
};
