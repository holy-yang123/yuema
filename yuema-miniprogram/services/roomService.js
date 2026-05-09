const request = require('../utils/request');

module.exports = {
  // 创建牌局
  createRoom(data) {
    return request.post('/room/create', data);
  },

  // 房主编辑等待中的牌局
  updateRoom(roomId, data) {
    return request.put(`/room/update?roomId=${encodeURIComponent(roomId)}`, data);
  },

  // 房主删除等待中的牌局
  deleteRoom(roomId) {
    return request.del(`/room/delete?roomId=${encodeURIComponent(roomId)}`);
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

  // 开始牌局（query 便于后端 @RequestParam 绑定）
  startRoom(roomId) {
    return request.post(`/room/start?roomId=${encodeURIComponent(roomId)}`, {});
  },

  // 结束牌局
  endRoom(roomId) {
    return request.post(`/room/end?roomId=${encodeURIComponent(roomId)}`, {});
  },

  leaveRoom(roomId) {
    return request.post(`/room/leave?roomId=${encodeURIComponent(roomId)}`, {});
  },

  kickMember(roomId, targetUserId) {
    const q = `roomId=${encodeURIComponent(roomId)}&targetUserId=${encodeURIComponent(targetUserId)}`;
    return request.post(`/room/kick?${q}`, {});
  },

  transferRoom(roomId, newOwnerId) {
    const q = `roomId=${encodeURIComponent(roomId)}&newOwnerId=${encodeURIComponent(newOwnerId)}`;
    return request.post(`/room/transfer?${q}`, {});
  },

  getRoomQrCode(roomId) {
    return request.get('/room/qrcode', { roomId });
  },

  /** 房主标记成员爽约，扣信誉分（每局每人仅一次） */
  reportNoShow(roomId, targetUserId) {
    return request.post('/room/no-show', { roomId, targetUserId });
  }
};
