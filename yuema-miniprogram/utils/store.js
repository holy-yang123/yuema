/**
 * 轻量级状态管理
 * 用于在页面间同步用户信息、Token 等全局状态
 */
class Store {
  constructor() {
    this.state = {
      userInfo: null,
      token: null
    };
    this.listeners = [];
  }

  /**
   * 更新状态并通知所有订阅者，同时同步到 app.globalData 以兼容旧代码
   * @param {Object} patch 状态补丁
   */
  setState(patch) {
    this.state = { ...this.state, ...patch };
    
    // 同步回 globalData 以兼容尚未重构的旧页面
    try {
      const app = typeof getApp === 'function' ? getApp() : null;
      if (app && app.globalData) {
        Object.keys(patch).forEach(key => {
          if (key in app.globalData) {
            app.globalData[key] = patch[key];
          }
        });
      }
    } catch (e) {
      // 忽略 App 未就绪时的错误
    }

    this.notify();
  }

  /**
   * 订阅状态变化
   * @param {Function} listener 回调函数
   * @returns {Function} 取消订阅的函数
   */
  subscribe(listener) {
    this.listeners.push(listener);
    // 立即执行一次以同步当前最新状态
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * 通知所有订阅者
   */
  notify() {
    this.listeners.forEach(l => {
      try {
        l(this.state);
      } catch (e) {
        console.error('[Store] Listener error:', e);
      }
    });
  }
}

module.exports = new Store();
