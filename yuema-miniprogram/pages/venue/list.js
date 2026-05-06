const venueService = require('../../services/venueService');

Page({
  data: {
    venues: [],
    refreshing: false,
    searchQuery: ''
  },

  onLoad() {
    this.loadVenues();
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
