App({
  globalData: {
    userInfo: null,
    token: null,
    location: null, // {longitude, latitude}
    address: '', // 地址描述
    // 修改为你的局域网 IP
    apiBaseUrl: 'http://192.168.1.140:8080/api'
  },

  onLaunch() {
    // 检查登录状态
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.getUserInfo();
    }
    
    // 获取位置信息
    this.updateLocation();
  },

  // 更新位置信息
  updateLocation() {
    return new Promise((resolve, reject) => {
      // 优先尝试获取精确位置
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          this.globalData.location = {
            longitude: res.longitude,
            latitude: res.latitude
          };
          resolve(this.globalData.location);
        },
        fail: (err) => {
          // 如果获取失败且没有历史位置，尝试让用户手动选
          console.error('获取位置失败:', err);
          resolve(null);
        }
      });
    });
  },

  // 登录
  login(nickname = null, avatarUrl = null) {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            // 调用后端登录接口
            wx.request({
              url: `${this.globalData.apiBaseUrl}/user/login`,
              method: 'POST',
              data: {
                openid: 'user_' + res.code, // 使用真实 code 模拟 openid
                nickname: nickname,
                avatarUrl: avatarUrl
              },
              success: (result) => {
                if (result.data.code === 200) {
                  const data = result.data.data;
                  this.globalData.token = data.token;
                  this.globalData.userInfo = data;
                  wx.setStorageSync('token', data.token);
                  resolve(data);
                } else if (result.data.code === 404) {
                  // 返回特定对象表示需要完善资料
                  resolve({ needProfile: true, openid: 'user_' + res.code });
                } else {
                  reject(result.data.message);
                }
              },
              fail: reject
            });
          } else {
            reject('微信登录失败');
          }
        },
        fail: reject
      });
    });
  },

  // 获取用户信息
  getUserInfo() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.globalData.apiBaseUrl}/user/info`,
        header: {
          'Authorization': `Bearer ${this.globalData.token}`
        },
        success: (res) => {
          if (res.data.code === 200) {
            this.globalData.userInfo = res.data.data;
            resolve(res.data.data);
          } else {
            reject(res.data.message);
          }
        },
        fail: reject
      });
    });
  },

  // 检查登录
  checkLogin() {
    if (!this.globalData.token) {
      wx.navigateTo({
        url: '/pages/user/login'
      });
      return false;
    }
    return true;
  }
});
