const venueService = require('../../services/venueService');

Page({
  data: {
    venues: [],
    refreshing: false,
    searchQuery: '',
    scrollViewHeightPx: 400
  },

  onLoad() {
    try {
      const h = wx.getWindowInfo().windowHeight;
      this.setData({ scrollViewHeightPx: Math.max(200, Math.floor(h * 0.68)) });
    } catch (e) {}
    this.loadVenues();
  },

  onReady() {
    this.updateScrollListHeight();
  },

  onShow() {
    wx.nextTick(() => this.updateScrollListHeight());
  },

  updateScrollListHeight() {
    try {
      const win = wx.getWindowInfo();
      wx.createSelectorQuery()
        .in(this)
        .select('.header')
        .boundingClientRect()
        .exec((res) => {
          const rect = res && res[0];
          if (!rect || typeof rect.bottom !== 'number') return;
          const px = Math.max(120, Math.floor(win.windowHeight - rect.bottom));
          this.setData({ scrollViewHeightPx: px });
        });
    } catch (e) {}
  },

  async loadVenues() {
    try {
      const res = await venueService.getVenueList();
      this.setData({
        venues: res.data || []
      });
    } catch (err) {
      console.error('加载场地失败:', err);
    }
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadVenues().finally(() => {
      this.setData({ refreshing: false });
    });
  },

  onSearchInput(e) {
    this.setData({ searchQuery: e.detail.value });
    // TODO: 实现搜索逻辑
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/venue/detail?id=${id}`
    });
  }
});
