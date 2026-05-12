const { clearAuthAndGoLogin, shouldForceRelogin } = require('./authRedirect');
const store = require('./store');
const { HTTP_CODE, BUSINESS_CODE } = require('./constants');

/** 将 wx.request 的 data 规范为业务 JSON 对象，避免网关 HTML / 非 JSON 导致读 .code 抛异常 */
function normalizeResponseData(raw) {
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'object') {
    return raw;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

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
        'Authorization': `Bearer ${store.state.token || ''}`,
        ...options.header
      },
      success: (res) => {
        if (res.statusCode === HTTP_CODE.SUCCESS) {
          const data = normalizeResponseData(res.data);
          // 非 JSON 或缺少业务 code 时拒绝，避免访问 undefined.code 崩溃
          if (data?.code == null) {
            wx.showToast({
              title: '服务响应异常',
              icon: 'none'
            });
            reject(new Error('INVALID_RESPONSE'));
            return;
          }
          if (data.code === BUSINESS_CODE.SUCCESS || silentCodes.indexOf(data.code) !== -1) {
            resolve(data);
          } else if (shouldForceRelogin(data)) {
            // 业务表示需重新登录
            clearAuthAndGoLogin({
              toastTitle: data.message || '请重新登录'
            });
            reject(data);
          } else {
            wx.showToast({
              title: data.message || '请求失败',
              icon: 'none'
            });
            reject(data);
          }
        } else if (res.statusCode === HTTP_CODE.UNAUTHORIZED) {
          // 未携带 token / JWT 失效
          const body = normalizeResponseData(res.data);
          clearAuthAndGoLogin({
            toastTitle: body?.message || '登录已过期'
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
