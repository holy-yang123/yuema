const request = require('../utils/request');

module.exports = {
  // 创建牌局
  createRoom(data) {
    return request.post('/room/create', data);
  },

  // 加入牌局
  joinRoom(roomNo) {
    return request.post('/room/join', { roomNo });
  },

  // 获取牌局信息
  getRoomInfo(roomId) {
    return request.get('/room/info', { roomId });
  },

  // 获取牌局列表
  getRoomList(longitude, latitude) {
    return request.get('/room/list', { longitude, latitude });
  },

  // 获取我的牌局
  getMyRooms() {
    return request.get('/room/my');
  },

  // 开始牌局
  startRoom(roomId) {
    return request.post('/room/start', { roomId });
  },

  // 结束牌局
  endRoom(roomId) {
    return request.post('/room/end', { roomId });
  }
};
