const app = getApp();

Page({
  data: {
    loading: false
  },

  onShow() {
    if (app.globalData.token) {
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  },

  async onWxLogin() {
    if (this.data.loading) {
      return;
    }
    this.setData({ loading: true });
    wx.showLoading({ title: '登录中...' });
    try {
      const res = await app.login();
      wx.hideLoading();
      if (res.needProfile) {
        wx.redirectTo({
          url: '/pages/user/index?needProfile=1&fromLoginGate=1'
        });
      } else {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '登录失败', icon: 'none' });
      console.error(err);
    } finally {
      this.setData({ loading: false });
    }
  }
});
