const app = getApp();
const roomService = require('../../services/roomService');
const venueService = require('../../services/venueService');

Page({
  data: {
    roomList: [],
    venueList: [],
    loading: false,
    gameTypeMap: {
      'sichuan': '四川麻将',
      'guobiao': '国标麻将',
      'guangdong': '广东麻将'
    }
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    if (app.globalData.token) {
      this.loadData();
    }
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 检查登录
  async checkLogin() {
    if (!app.globalData.token) {
      try {
        await app.login();
        this.loadData();
      } catch (err) {
        console.error('登录失败:', err);
      }
    }
  },

  // 加载数据
  async loadData() {
    this.setData({ loading: true });
    
    try {
      // 加载牌局列表
      const roomRes = await roomService.getRoomList();
      this.setData({
        roomList: roomRes.data || []
      });

      // 加载附近场地
      this.loadNearbyVenues();
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载附近场地
  loadNearbyVenues() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        venueService.getNearbyVenues(res.longitude, res.latitude, 5)
          .then(res => {
            this.setData({
              venueList: res.data || []
            });
          })
          .catch(err => {
            console.error('获取附近场地失败:', err);
          });
      },
      fail: () => {
        // 获取位置失败，加载默认场地
        venueService.getVenueList()
          .then(res => {
            this.setData({
              venueList: (res.data || []).slice(0, 5)
            });
          });
      }
    });
  },

  // 创建牌局
  createRoom() {
    wx.navigateTo({
      url: '/pages/room/create'
    });
  },

  // 加入牌局（扫码或输入房间号）
  joinRoom() {
    wx.showActionSheet({
      itemList: ['扫码加入', '输入房间号'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 扫码
          wx.scanCode({
            success: (result) => {
              // 解析二维码中的房间号
              console.log('扫码结果:', result);
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
      await roomService.joinRoom(roomNo);
      wx.showToast({
        title: '加入成功',
        icon: 'success'
      });
      this.loadData();
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
