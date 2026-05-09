const roomService = require('../../services/roomService');

Page({
  data: {
    rooms: [],
    filteredRooms: [],
    currentTab: 'all',
    refreshing: false,
    searchQuery: '',
    scrollViewHeightPx: 400,
    /** 个人中心「我的牌局」进入时为 true */
    isMyRooms: false,
    gameTypeMap: {
      'sichuan': '四川麻将',
      'guobiao': '国标麻将',
      'guangdong': '广东麻将'
    }
  },

  onLoad(options) {
    const isMyRooms = options && options.type === 'my';
    this.setData({ isMyRooms });
    if (isMyRooms) {
      wx.setNavigationBarTitle({ title: '我的牌局' });
    }
    try {
      const h = wx.getWindowInfo().windowHeight;
      this.setData({ scrollViewHeightPx: Math.max(200, Math.floor(h * 0.62)) });
    } catch (e) {}
    this.loadRooms();
  },

  onReady() {
    this.updateScrollListHeight();
  },

  onShow() {
    this.loadRooms();
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

  async loadRooms() {
    try {
      let res;
      if (this.data.isMyRooms) {
        res = await roomService.getMyRooms();
      } else {
        let location = null;
        try {
          const app = getApp();
          location = app && app.globalData ? app.globalData.location : null;
        } catch (e) {
          // ignore
        }
        res = await roomService.getRoomList(
          location ? location.longitude : null,
          location ? location.latitude : null
        );
      }
      this.setData({
        rooms: res.data || []
      }, () => {
        this.filterRooms();
      });
    } catch (err) {
      console.error('加载牌局失败:', err);
    }
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.loadRooms().finally(() => {
      this.setData({ refreshing: false });
    });
  },

  onSearchInput(e) {
    this.setData({
      searchQuery: e.detail.value
    }, () => {
      this.filterRooms();
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab
    }, () => {
      this.filterRooms();
    });
  },

  filterRooms() {
    let filtered = [...this.data.rooms];
    
    // 状态过滤
    if (this.data.currentTab === 'waiting') {
      filtered = filtered.filter(r => r.status === 0);
    } else if (this.data.currentTab === 'playing') {
      filtered = filtered.filter(r => r.status === 1);
    }

    // 搜索过滤
    if (this.data.searchQuery) {
      const query = this.data.searchQuery.toLowerCase();
      filtered = filtered.filter((r) => {
        const no = (r.roomNo && String(r.roomNo).toLowerCase()) || '';
        const typeLabel = this.data.gameTypeMap[r.gameType] || r.gameType || '';
        return no.includes(query) || String(typeLabel).toLowerCase().includes(query);
      });
    }

    this.setData({ filteredRooms: filtered });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/room/detail?id=${id}`
    });
  },

  async onJoin(e) {
    const id = e.currentTarget.dataset.id;
    const room = this.data.rooms.find(r => r.id === id);
    if (!room) return;

    try {
      const res = await roomService.joinRoom(room.roomNo);
      wx.showToast({
        title: '加入成功',
        icon: 'success'
      });
      const roomId = res.data && res.data.roomId;
      if (roomId) {
        wx.navigateTo({
          url: `/pages/room/detail?id=${roomId}`
        });
      }
      this.loadRooms();
    } catch (err) {
      wx.showToast({
        title: err.message || '加入失败',
        icon: 'none'
      });
    }
  },

  goToCreate() {
    wx.navigateTo({
      url: '/pages/room/create'
    });
  }
});
