const roomService = require('../../services/roomService');
const { GAME_TYPE_LABELS } = require('../../utils/gameTypeLabels');
const { buildRuleCardTags } = require('../../utils/gameRulesDisplay');

Page({
  behaviors: [require('../../behaviors/themeBehavior')],
  data: {
    rooms: [],
    filteredRooms: [],
    currentTab: 'all',
    refreshing: false,
    searchQuery: '',
    scrollViewHeightPx: 400,
    /** 个人中心「我的牌局」进入时为 true */
    isMyRooms: false,
    /** 用于判断是否本人发布的牌局 */
    currentUserId: null,
    gameTypeMap: { ...GAME_TYPE_LABELS }
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
      const app = typeof getApp === 'function' ? getApp() : null;
      const u = app && app.globalData ? app.globalData.userInfo : null;
      const currentUserId = u ? (u.userId != null ? u.userId : u.id) : null;
      // 与首页卡片同源解析 gameRules，编辑保存后 onShow 刷新即可展示最新规则（含自定义条文）
      const rooms = (res.data || []).map((r) => ({
        ...r,
        ruleCardTags: buildRuleCardTags(r)
      }));
      this.setData({
        rooms,
        currentUserId
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
        const ruleHaystack = (r.ruleCardTags || []).map((t) => t.label).join(' ').toLowerCase();
        const remarkHay = (r.remark && String(r.remark).toLowerCase()) || '';
        return (
          no.includes(query) ||
          String(typeLabel).toLowerCase().includes(query) ||
          ruleHaystack.includes(query) ||
          remarkHay.includes(query)
        );
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
  },

  goEditRoom(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/room/create?id=${id}`
    });
  },

  confirmDeleteRoom(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除牌局',
      content: '确定删除该牌局吗？删除后不可恢复。',
      success: async (r) => {
        if (!r.confirm) {
          return;
        }
        try {
          wx.showLoading({ title: '删除中' });
          await roomService.deleteRoom(id);
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadRooms();
        } catch (err) {
          wx.hideLoading();
          wx.showToast({
            title: (err && err.message) || '删除失败',
            icon: 'none'
          });
        }
      }
    });
  }
});
