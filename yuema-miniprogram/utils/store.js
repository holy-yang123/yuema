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
   * 更新状态并通知所有订阅者
   * @param {Object} patch 状态补丁
   */
  setState(patch) {
    this.state = { ...this.state, ...patch };
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
