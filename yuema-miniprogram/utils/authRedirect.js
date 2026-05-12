const { LOGIN_PAGE } = require('./pageRoutes');

/**
 * 根据服务端 Result 判断是否需要强制重新登录（与 AuthInterceptor 401 文案、UserController「用户不存在」对齐）
 */
function shouldForceRelogin(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const msg = data.message || '';
  const code = data.code;
  // code 401：未登录 / 登录已过期；文案兜底：用户库记录缺失时 JWT 仍有效会走 200+500+「用户不存在」
  return code === 401 || msg === '用户不存在' || msg === '登录已过期' || msg === '未登录';
}

/**
 * 清除 token 与内存用户信息并跳转登录页，避免各处分叉逻辑
 */
function clearAuthAndGoLogin(options) {
  const opts = options || {};
  const toastTitle = opts.toastTitle != null ? opts.toastTitle : '请重新登录';
  const showToast = opts.showToast !== false;

  try {
    wx.removeStorageSync('token');
  } catch (e) {
    // 存储异常不影响跳转
  }

  const store = require('./store');
  store.setState({
    token: null,
    userInfo: null
  });

  if (showToast && toastTitle) {
    wx.showToast({ title: toastTitle, icon: 'none' });
  }

  wx.reLaunch({ url: LOGIN_PAGE });
}

module.exports = {
  shouldForceRelogin,
  clearAuthAndGoLogin
};
