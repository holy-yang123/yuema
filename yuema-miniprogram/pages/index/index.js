const app = getApp();
const roomService = require('../../services/roomService');
const venueService = require('../../services/venueService');
const { LOGIN_PAGE } = require('../../utils/pageRoutes');
const { GAME_TYPE_LABELS } = require('../../utils/gameTypeLabels');
const { buildRuleCardTags } = require('../../utils/gameRulesDisplay');
const { attachScheduleDisplay } = require('../../utils/roomScheduleDisplay');

Page({
  behaviors: [require('../../behaviors/themeBehavior')],
  data: {
    roomList: [],
    venueList: [],
    loading: false,
    /** 右上角头像：与 globalData 同步，避免首帧 undefined */
    userInfo: {},
    address: '', // 当前地址
    /** 当前用户 id，用于判断是否本人发布的牌局（展示编辑/删除） */
    currentUserId: null,
    gameTypeMap: { ...GAME_TYPE_LABELS }
  },

  onLoad() {
    this.ensureLoggedIn();
  },

  onShow() {
    if (!app.globalData.token) {
      wx.reLaunch({
        url: LOGIN_PAGE
      });
      return;
    }
    this.setData({
      address: app.globalData.address || this.data.address,
      userInfo: app.globalData.userInfo || {}
    });
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  ensureLoggedIn() {
    if (!app.globalData.token) {
      wx.reLaunch({
        url: LOGIN_PAGE
      });
    }
  },

  // 加载数据（合并 setData，减少列表区多次布局）
  async loadData() {
    this.setData({ loading: true });
    try {
      let { location } = app.globalData;
      if (!location) {
        location = await app.updateLocation();
      }

      const roomRes = await roomService.getRoomList(
        location ? location.longitude : null,
        location ? location.latitude : null
      );
      const u = app.globalData.userInfo;
      const currentUserId = u ? (u.userId != null ? u.userId : u.id) : null;
      // 预设细则 + customLines，与牌局列表卡片一致
      const roomList = (roomRes.data || []).slice(0, 5).map((r) => ({
        ...attachScheduleDisplay(r),
        ruleCardTags: buildRuleCardTags(r)
      }));

      let venueList = [];
      if (location) {
        const venueRes = await venueService.getNearbyVenues(location.longitude, location.latitude, 5);
        venueList = venueRes.data || [];
      } else {
        const venueRes = await venueService.getVenueList();
        venueList = (venueRes.data || []).slice(0, 5);
      }

      const patch = {
        loading: false,
        roomList,
        venueList,
        currentUserId,
        // 供首页右上角头像绑定：原先仅用全局变量未 setData，导致占位图路径失效时出现空白方块
        userInfo: app.globalData.userInfo || {}
      };
      if (location && !this.data.address) {
        patch.address = '获取位置成功';
      }
      this.setData(patch);
    } catch (err) {
      console.error('加载数据失败:', err);
      this.setData({ loading: false });
    }
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
