const venueService = require('../../services/venueService');

function parseVenueImages(imageUrls) {
  if (!imageUrls) {
    return [];
  }
  if (Array.isArray(imageUrls)) {
    return imageUrls.filter(Boolean);
  }
  const s = String(imageUrls).trim();
  if (!s) {
    return [];
  }
  if (s.startsWith('[')) {
    try {
      const a = JSON.parse(s);
      return Array.isArray(a) ? a.filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

Page({
  behaviors: [require('../../behaviors/themeBehavior')],
  data: {
    venue: null,
    bannerImages: ['/images/default-venue.png']
  },

  onLoad(options) {
    if (options.id) {
      this.loadVenue(options.id);
    }
  },

  async loadVenue(id) {
    try {
      const res = await venueService.getVenueInfo(id);
      const v = res.data;
      let bannerImages = parseVenueImages(v && v.imageUrls);
      if (bannerImages.length === 0) {
        bannerImages = ['/images/default-venue.png'];
      }
      this.setData({
        venue: v,
        bannerImages
      });
    } catch (err) {
      console.error('加载场地详情失败:', err);
    }
  },

  openMap() {
    const { venue } = this.data;
    if (!venue) return;
    const lat = Number(venue.latitude);
    const lng = Number(venue.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      wx.showToast({ title: '暂无地图坐标', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude: lat,
      longitude: lng,
      name: venue.name || '',
      address: venue.address || ''
    });
  },

  copyAddress() {
    const addr = this.data.venue && this.data.venue.address;
    if (!addr) {
      wx.showToast({ title: '暂无地址', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: String(addr),
      success: () => wx.showToast({ title: '地址已复制', icon: 'none' })
    });
  },

  callPhone() {
    const phone = this.data.venue && this.data.venue.phone;
    if (!phone) {
      wx.showToast({ title: '暂无电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({
      phoneNumber: String(phone).replace(/\s/g, '')
    });
  },

  goToBook() {
    wx.showModal({
      title: '到店预订',
      content: '在线选座与支付暂未开放。请通过电话联系门店，或复制地址后到店咨询预订。',
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
