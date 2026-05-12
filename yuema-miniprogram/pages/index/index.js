const app = getApp();
const roomService = require('../../services/roomService');
const venueService = require('../../services/venueService');
const { LOGIN_PAGE } = require('../../utils/pageRoutes');
const { GAME_TYPE_LABELS } = require('../../utils/gameTypeLabels');
const { buildRuleCardTags } = require('../../utils/gameRulesDisplay');
const { attachScheduleDisplay } = require('../../utils/roomScheduleDisplay');

Page({
  behaviors: [
    require('../../behaviors/themeBehavior'),
    require('../../behaviors/authBehavior')
  ],
  data: {
    roomList: [],
    venueList: [],
    loading: false,
    address: '', // 当前地址
    /** 启用 authBehavior 的强制登录拦截 */
    requireAuth: true,
    gameTypeMap: { ...GAME_TYPE_LABELS }
  },

  onLoad() {
    // 逻辑已由 behaviors 处理
  },

  onShow() {
    this.setData({
      address: app.globalData.address || this.data.address
    });
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载数据（优化为并发请求并支持预加载）
  async loadData() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      // 1. 尝试消费 App.js 的预加载数据 (30秒内有效)
      const { preloadedData, preloadTimestamp } = app.globalData;
      const isPreloadValid = preloadedData && (Date.now() - preloadTimestamp < 30000);
      
      if (isPreloadValid) {
        console.log('[Index] Consuming preloaded data');
        this.applyData(preloadedData.rooms, preloadedData.venues);
        // 消费后清除，防止重复使用过时数据
        app.globalData.preloadedData = null;
        return;
      }

      // 2. 无缓存时发起并发请求
      console.log('[Index] No valid preload, fetching fresh data');
      let loc = app.globalData.location;
      if (!loc) {
        loc = await app.updateLocation();
      }

      const [roomRes, venueRes] = await Promise.all([
        roomService.getRoomList(loc?.longitude, loc?.latitude),
        loc 
          ? venueService.getNearbyVenues(loc.longitude, loc.latitude, 5)
          : venueService.getVenueList()
      ]);

      this.applyData(roomRes, venueRes);
      
      if (loc && !this.data.address) {
        this.setData({ address: '获取位置成功' });
      }
    } catch (err) {
      console.error('[Index] Load failed:', err);
      this.setData({ loading: false });
    }
  },

  /** 渲染数据到页面 */
  applyData(roomRes, venueRes) {
    const roomList = (roomRes?.data || []).slice(0, 5).map((r) => ({
      ...attachScheduleDisplay(r),
      ruleCardTags: buildRuleCardTags(r)
    }));
    
    const venueList = (venueRes?.data || []).slice(0, 5);

    this.setData({
      roomList,
      venueList,
      loading: false
    });
  },

  // 加载附近场地（此方法已合并到 loadData 中，保留为空或删除）
  loadNearbyVenues() {
    // 逻辑已整合到 loadData
  },

  // 重新选择位置
  reSelectLocation() {
    wx.chooseLocation({
      success: (res) => {
        const location = {
          longitude: res.longitude,
          latitude: res.latitude
        };
        app.globalData.location = location;
        app.globalData.address = res.name || res.address;
        this.setData({
          address: app.globalData.address
        });
        this.loadData();
      },
      fail: (err) => {
        console.error('选择位置失败:', err);
      }
    });
  },

  // 创建牌局
  createRoom() {
    wx.navigateTo({
      url: '/pages/room/create'
    });
  },

  parseRoomNoFromScan(raw) {
    if (!raw || typeof raw !== 'string') {
      return '';
    }
    const s = raw.trim();
    const m = s.match(/(?:\?|&)scene=([^&]+)/i);
    if (m) {
      try {
        return decodeURIComponent(m[1]);
      } catch (e) {
        return m[1];
      }
    }
    if (/^\d{6}$/.test(s)) {
      return s;
    }
    return '';
  },

  // 加入牌局（扫码或输入房间号）
  joinRoom() {
    wx.showActionSheet({
      itemList: ['扫码加入', '输入房间号'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.scanCode({
            success: (result) => {
              const raw = result.result || result.path || '';
              const roomNo = this.parseRoomNoFromScan(raw);
              if (roomNo) {
                this.doJoinRoom(roomNo);
              } else {
                wx.showToast({ title: '未识别到房间号', icon: 'none' });
              }
            }
          });
        } else {
          // 输入房间号
          wx.showModal({
            title: '加入牌局',
            editable: true,
            placeholderText: '请输入6位房间号',
            success: (result) => {
              if (result.confirm && result.content) {
                this.doJoinRoom(result.content);
              }
            }
          });
        }
      }
    });
  },

  // 执行加入牌局
  async doJoinRoom(roomNo) {
    try {
      const res = await roomService.joinRoom(roomNo);
      wx.showToast({
        title: '加入成功',
        icon: 'success'
      });
      this.loadData();
      const roomId = res.data && res.data.roomId;
      if (roomId) {
        wx.navigateTo({
          url: `/pages/room/detail?id=${roomId}`
        });
      }
    } catch (err) {
      wx.showToast({
        title: err.message || '加入失败',
        icon: 'none'
      });
    }
  },

  // 快速加入
  quickJoin(e) {
    const roomId = e.currentTarget.dataset.id;
    const room = this.data.roomList.find(r => r.id === roomId);
    if (room) {
      this.doJoinRoom(room.roomNo);
    }
  },

  // 跳转到牌局详情
  goToRoomDetail(e) {
    const roomId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/room/detail?id=${roomId}`
    });
  },

  // 编辑本人发布的等待中牌局
  goEditRoom(e) {
    const roomId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/room/create?id=${roomId}`
    });
  },

  // 删除本人发布的等待中牌局
  confirmDeleteRoom(e) {
    const roomId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除牌局',
      content: '确定删除该牌局吗？删除后不可恢复。',
      success: async (r) => {
        if (!r.confirm) {
          return;
        }
        try {
          wx.showLoading({ title: '删除中' });
          await roomService.deleteRoom(roomId);
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadData();
        } catch (err) {
          wx.hideLoading();
          wx.showToast({
            title: (err && err.message) || '删除失败',
            icon: 'none'
          });
        }
      }
    });
  },

  // 跳转到牌局列表
  goToRoomList() {
    wx.switchTab({
      url: '/pages/room/list'
    });
  },

  // 跳转到场地列表
  goToVenue() {
    wx.switchTab({
      url: '/pages/venue/list'
    });
  },

  // 跳转到场地详情
  goToVenueDetail(e) {
    const venueId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/venue/detail?id=${venueId}`
    });
  }
});
