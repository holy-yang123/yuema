const venueService = require('../../services/venueService');

function firstCoverImage(imageUrls) {
  if (!imageUrls) {
    return '/images/default-venue.png';
  }
  if (Array.isArray(imageUrls) && imageUrls.length) {
    return imageUrls[0];
  }
  const s = String(imageUrls).trim();
  if (!s) {
    return '/images/default-venue.png';
  }
  if (s.startsWith('[')) {
    try {
      const a = JSON.parse(s);
      if (Array.isArray(a) && a.length) {
        return a[0];
      }
    } catch (e) {
      // ignore
    }
  }
  const first = s.split(',')[0].trim();
  return first || '/images/default-venue.png';
}

Page({
  data: {
    allVenues: [],
    filteredVenues: [],
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
      const raw = res.data || [];
      const allVenues = raw.map((v) => ({
        ...v,
        coverUrl: firstCoverImage(v.imageUrls)
      }));
      this.setData({ allVenues }, () => this.filterVenues());
    } catch (err) {
      console.error('加载场地失败:', err);
    }
  },

  filterVenues() {
    const q = (this.data.searchQuery || '').trim().toLowerCase();
    let list = this.data.allVenues || [];
    if (q) {
      list = list.filter((v) => {
        const name = (v.name && String(v.name).toLowerCase()) || '';
        const addr = (v.address && String(v.address).toLowerCase()) || '';
        return name.includes(q) || addr.includes(q);
      });
    }
    this.setData({ filteredVenues: list });
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadVenues().finally(() => {
      this.setData({ refreshing: false });
    });
  },

  onSearchInput(e) {
    this.setData({ searchQuery: e.detail.value }, () => this.filterVenues());
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/venue/detail?id=${id}`
    });
  }
});
