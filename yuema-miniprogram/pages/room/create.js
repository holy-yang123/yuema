const roomService = require('../../services/roomService');
const venueService = require('../../services/venueService');

Page({
  data: {
    gameTypes: [
      { id: 'sichuan', name: '四川麻将' },
      { id: 'guobiao', name: '国标麻将' },
      { id: 'guangdong', name: '广东麻将' }
    ],
    gameTypeIndex: 0,
    maxPlayersOptions: [2, 3, 4],
    maxPlayersIndex: 2,
    venues: [],
    venueIndex: -1,
    selectedLocation: null // {address, latitude, longitude}
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

  onGameTypeChange(e) {
    this.setData({ gameTypeIndex: e.detail.value });
  },

  onMaxPlayersChange(e) {
    this.setData({ maxPlayersIndex: e.detail.value });
  },

  onVenueChange(e) {
    this.setData({ venueIndex: e.detail.value });
  },

  // 选择位置
  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          selectedLocation: {
            address: res.name || res.address,
            latitude: res.latitude,
            longitude: res.longitude
          }
        });
      }
    });
  },

  async submit() {
    const { gameTypes, gameTypeIndex, maxPlayersOptions, maxPlayersIndex, venues, venueIndex } = this.data;
    
    const data = {
      gameType: gameTypes[gameTypeIndex].id,
      maxPlayers: maxPlayersOptions[maxPlayersIndex],
      venueId: venueIndex === -1 ? null : venues[venueIndex].id,
      latitude: venueIndex === -1 && this.data.selectedLocation ? this.data.selectedLocation.latitude : null,
      longitude: venueIndex === -1 && this.data.selectedLocation ? this.data.selectedLocation.longitude : null
    };

    try {
      wx.showLoading({ title: '创建中...' });
      const res = await roomService.createRoom(data);
      wx.hideLoading();
      
      wx.showToast({
        title: '创建成功',
        icon: 'success'
      });

      // 跳转到房间详情
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/room/detail?id=${res.data.id}`
        });
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: err.message || '创建失败',
        icon: 'none'
      });
    }
  }
});
