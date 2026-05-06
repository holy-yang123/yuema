const scoreService = require('../../services/scoreService');

Page({
  data: {
    history: [],
    roomNo: '',
    gameType: ''
  },

  onLoad(options) {
    if (options.roomId) {
      this.loadHistory(options.roomId);
    }
  },

  async loadHistory(roomId) {
    try {
      const res = await scoreService.getScoreHistory(roomId);
      this.setData({
        history: res.data || []
      });
    } catch (err) {
      console.error('加载计分历史失败:', err);
    }
  }
});
