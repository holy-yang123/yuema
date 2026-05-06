const app = getApp();
const roomService = require('../../services/roomService');
const scoreService = require('../../services/scoreService');

Page({
  data: {
    roomId: null,
    room: {},
    members: [],
    emptySeats: [],
    isOwner: false,
    currentRound: 0,
    scoreSummary: { memberScores: [] },
    settlement: { settlements: [] },
    gameTypeMap: {
      'sichuan': '四川麻将',
      'guobiao': '国标麻将',
      'guangdong': '广东麻将'
    }
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ roomId: parseInt(options.id) });
      this.loadRoomDetail();
    }
  },

  onShow() {
    if (this.data.roomId) {
      this.loadRoomDetail();
    }
  },

  // 加载房间详情
  async loadRoomDetail() {
    try {
      const res = await roomService.getRoomInfo(this.data.roomId);
      const data = res.data;
      
      // 检查是否是房主
      const currentUserId = app.globalData.userInfo?.userId;
      const isOwner = data.members.some(m => m.userId === currentUserId && m.role === 1);
      
      // 计算空位
      const emptySeats = [];
      const occupiedSeats = data.members.length;
      for (let i = 0; i < data.room.maxPlayers - occupiedSeats; i++) {
        emptySeats.push(i);
      }

      this.setData({
        room: data.room,
        members: data.members,
        emptySeats: emptySeats,
        isOwner: isOwner
      });

      // 加载分数信息
      if (data.room.status === 1 || data.room.status === 2) {
        this.loadScoreData();
      }
    } catch (err) {
      console.error('加载房间详情失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 加载分数数据
  async loadScoreData() {
    try {
      // 获取分数汇总
      const summaryRes = await scoreService.getScoreSummary(this.data.roomId);
      this.setData({
        scoreSummary: summaryRes.data,
        currentRound: summaryRes.data.totalRounds
      });

      // 如果已结束，获取结算信息
      if (this.data.room.status === 2) {
        const settlementRes = await scoreService.getSettlement(this.data.roomId);
        this.setData({
          settlement: settlementRes.data
        });
      }
    } catch (err) {
      console.error('加载分数数据失败:', err);
    }
  },

  // 获取玩家名称
  getPlayerName(userId) {
    const member = this.data.members.find(m => m.userId === userId);
    return member ? member.nickname : '未知';
  },

  // 开始游戏
  async startGame() {
    if (this.data.members.length < 2) {
      wx.showToast({
        title: '至少需要2人才能开始',
        icon: 'none'
      });
      return;
    }

    try {
      await roomService.startRoom(this.data.roomId);
      wx.showToast({
        title: '牌局开始',
        icon: 'success'
      });
      this.loadRoomDetail();
    } catch (err) {
      wx.showToast({
        title: err.message || '开始失败',
        icon: 'none'
      });
    }
  },

  // 结束游戏
  endGame() {
    wx.showModal({
      title: '确认结束',
      content: '结束牌局后将进行最终结算，确认结束吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await roomService.endRoom(this.data.roomId);
            wx.showToast({
              title: '牌局已结束',
              icon: 'success'
            });
            this.loadRoomDetail();
          } catch (err) {
            wx.showToast({
              title: err.message || '结束失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 去记录分数
  goToRecordScore() {
    wx.navigateTo({
      url: `/pages/score/record?roomId=${this.data.roomId}&roundNo=${this.data.currentRound + 1}`
    });
  },

  // 查看历史记录
  viewScoreHistory() {
    wx.navigateTo({
      url: `/pages/score/history?roomId=${this.data.roomId}`
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `快来加入我的牌局！房间号: ${this.data.room.roomNo}`,
      path: `/pages/room/detail?id=${this.data.roomId}`,
      imageUrl: '/images/share-room.png'
    };
  }
});
