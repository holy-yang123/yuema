const venueService = require('../../services/venueService');

Page({
  data: {
    venue: null
  },

  onLoad(options) {
    if (options.id) {
      this.loadVenue(options.id);
    }
  },

  async loadVenue(id) {
    try {
      const res = await venueService.getVenueInfo(id);
      this.setData({
        venue: res.data
      });
    } catch (err) {
      console.error('加载场地详情失败:', err);
    }
  },

  openMap() {
    const { venue } = this.data;
    if (!venue) return;
    wx.openLocation({
      latitude: venue.latitude,
      longitude: venue.longitude,
      name: venue.name,
      address: venue.address
    });
  },

  goToBook() {
    wx.showToast({
      title: '预订功能开发中',
      icon: 'none'
    });
  }
});
