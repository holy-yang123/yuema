// 禁止在模块顶层 getApp()：app.js 会在 App() 执行前 require 本文件，此时 getApp() 为 undefined
const { clearAuthAndGoLogin, shouldForceRelogin } = require('./authRedirect');

function safeGetApp() {
  try {
    return typeof getApp === 'function' ? getApp() : null;
  } catch (e) {
    return null;
  }
}

// 封装请求方法；silentBusinessCodes：这些业务 code 不弹全局 toast，仍 resolve（如登录 NEED_PROFILE）
const request = (options) => {
  const silentCodes = options.silentBusinessCodes || [];
  return new Promise((resolve, reject) => {
    const app = safeGetApp();
    if (!app || !app.globalData) {
      wx.showToast({
        title: '应用未就绪',
        icon: 'none'
      });
      reject(new Error('应用未就绪'));
      return;
    }

    wx.request({
      url: `${app.globalData.apiBaseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${app.globalData.token || ''}`,
        ...options.header
      },
      success: (res) => {
        if (res.statusCode === 200) {
          if (res.data.code === 200 || silentCodes.indexOf(res.data.code) !== -1) {
            resolve(res.data);
          } else if (shouldForceRelogin(res.data)) {
            // HTTP 200 但业务表示需重新登录（如用户记录已删仍带旧 JWT，接口返回「用户不存在」）
            clearAuthAndGoLogin({
              toastTitle: res.data.message || '请重新登录'
            });
            reject(res.data);
          } else {
            wx.showToast({
              title: res.data.message || '请求失败',
              icon: 'none'
            });
            reject(res.data);
          }
        } else if (res.statusCode === 401) {
          // 未携带 token / JWT 失效：服务端统一 401
          clearAuthAndGoLogin({
            toastTitle: (res.data && res.data.message) || '登录已过期'
          });
          reject(res);
        } else {
          wx.showToast({
            title: '网络错误',
            icon: 'none'
          });
          reject(res);
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
};

module.exports = {
  get: (url, data, extra = {}) => request({ url, method: 'GET', data, ...extra }),
  post: (url, data, extra = {}) => request({ url, method: 'POST', data, ...extra }),
  put: (url, data, extra = {}) => request({ url, method: 'PUT', data, ...extra }),
  del: (url, data, extra = {}) => request({ url, method: 'DELETE', data, ...extra })
};
