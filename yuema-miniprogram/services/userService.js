const request = require('../utils/request');

module.exports = {
  // 登录（若通过封装调用，404 NEED_PROFILE 需静默）
  login(data) {
    return request.post('/user/login', data, { silentBusinessCodes: [404] });
  },

  // 获取用户信息
  getUserInfo() {
    return request.get('/user/info');
  },

  // 更新用户信息
  updateUserInfo(data) {
    return request.put('/user/info', data);
  },

  getStats() {
    return request.get('/user/stats');
  },

  getGameRecords(current = 1, size = 20) {
    return request.get('/user/game-records', { current, size });
  }
};
