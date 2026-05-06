const request = require('../utils/request');

module.exports = {
  // 登录
  login(data) {
    return request.post('/user/login', data);
  },

  // 获取用户信息
  getUserInfo() {
    return request.get('/user/info');
  },

  // 更新用户信息
  updateUserInfo(data) {
    return request.put('/user/info', data);
  }
};
