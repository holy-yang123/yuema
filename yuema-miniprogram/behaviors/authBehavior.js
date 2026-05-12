const store = require('../utils/store');
const { LOGIN_PAGE } = require('../utils/pageRoutes');

/**
 * 权限与状态同步 Behavior
 * 1. 自动从 store 同步 userInfo 和 isLoggedIn 状态到页面 data
 * 2. 支持 requireAuth 配置，自动处理未登录拦截
 */
module.exports = Behavior({
  data: {
    userInfo: {},
    isLoggedIn: false
  },
  
  lifetimes: {
    attached() {
      // 订阅 Store 变化
      this._unsubscribeStore = store.subscribe((state) => {
        const patch = {
          userInfo: state.userInfo || {},
          isLoggedIn: !!state.token
        };
        
        this.setData(patch);
        
        // 登录拦截逻辑：如果页面要求登录且当前未登录
        if (this.data.requireAuth && !state.token) {
          console.log('[authBehavior] Unauthorized access, redirecting to login');
          wx.reLaunch({
            url: LOGIN_PAGE
          });
        }
      });
    },
    
    detached() {
      // 页面销毁时取消订阅，防止内存泄漏
      if (this._unsubscribeStore) {
        this._unsubscribeStore();
      }
    }
  }
});
