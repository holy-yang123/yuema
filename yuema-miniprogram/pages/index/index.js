const app = getApp();
const roomService = require('../../services/roomService');
const venueService = require('../../services/venueService');

Page({
  data: {
    roomList: [],
    venueList: [],
    loading: false,
    address: '', // 当前地址
    gameTypeMap: {
      'sichuan': '四川麻将',
      'guobiao': '国标麻将',
      'guangdong': '广东麻将'
    }
  },

  onLoad() {
    this.ensureLoggedIn();
  },

  onShow() {
    if (!app.globalData.token) {
      wx.reLaunch({
        url: '/pages/user/login'
      });
      return;
    }
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

  ensureLoggedIn() {
    if (!app.globalData.token) {
      wx.reLaunch({
        url: '/pages/user/login'
      });
    }
  },

  // 加载数据
  async loadData() {
    this.setData({ loading: true });
    
    try {
      let { location } = app.globalData;
      if (!location) {
        location = await app.updateLocation();
      }

      // 如果有经纬度但没有地址，尝试获取地址 (Mock 逻辑，实际需调用逆地址解析 API)
      if (location && !this.data.address) {
        this.setData({ address: '获取位置成功' });
      }

      // 加载牌局列表
      const roomRes = await roomService.getRoomList(
        location ? location.longitude : null,
        location ? location.latitude : null
      );
      this.setData({
        roomList: (roomRes.data || []).slice(0, 5)
      });

      // 加载附近场地
      if (location) {
        const venueRes = await venueService.getNearbyVenues(location.longitude, location.latitude, 5);
        this.setData({
          venueList: venueRes.data || []
        });
      } else {
        const venueRes = await venueService.getVenueList();
        this.setData({
          venueList: (venueRes.data || []).slice(0, 5)
        });
      }
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
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
