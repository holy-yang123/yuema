const app = getApp();
const roomService = require('../../services/roomService');
const scoreService = require('../../services/scoreService');

Page({
  data: {
    roomId: null,
    roundNo: 1,
    players: [],
    scoreType: 'zimo',
    remark: '',
    totalScore: 0,
    submitting: false,
    scoreTypes: [
      { value: 'zimo', label: '自摸' },
      { value: 'dianpao', label: '点炮' },
      { value: 'gangshanghua', label: '杠上花' },
      { value: 'qianggang', label: '抢杠' },
      { value: 'angang', label: '暗杠' },
      { value: 'minggang', label: '明杠' },
      { value: 'other', label: '其他' }
    ]
  },

  onLoad(options) {
    this.setData({
      roomId: parseInt(options.roomId),
      roundNo: parseInt(options.roundNo) || 1
    });
    this.loadRoomMembers();
  },

  // 加载房间成员
  async loadRoomMembers() {
    try {
      const res = await roomService.getRoomInfo(this.data.roomId);
      const members = res.data.members.map(m => ({
        userId: m.userId,
        nickname: m.nickname,
        avatarUrl: m.avatarUrl,
        score: 0
      }));
      this.setData({ players: members });
    } catch (err) {
      console.error('加载成员失败:', err);
    }
  },

  // 选择计分类型
  selectScoreType(e) {
    this.setData({ scoreType: e.currentTarget.dataset.value });
  },

  // 输入分数
  onScoreInput(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const score = value === '' ? 0 : parseInt(value);
    
    const players = this.data.players;
    // 保持符号（根据输入框前的正负号）
    const currentScore = players[index].score;
    players[index].score = currentScore >= 0 ? score : -score;
    
    this.setData({ players });
    this.calculateTotal();
  },

  // 计算总分
  calculateTotal() {
    const total = this.data.players.reduce((sum, p) => sum + p.score, 0);
    this.setData({ totalScore: total });
  },

  // 切换正负号
  toggleSign(e) {
    const index = e.currentTarget.dataset.index;
    const players = this.data.players;
    players[index].score = -players[index].score;
    this.setData({ players });
    this.calculateTotal();
  },

  // 输入备注
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  // 快捷设置 - 自摸模板（假设底分1分，自摸每人输1分，赢家得3分）
  quickSetZimo() {
    const players = this.data.players;
    if (players.length !== 4) {
      wx.showToast({ title: '仅支持4人模板', icon: 'none' });
      return;
    }
    
    // 第一个玩家赢，其他输
    players[0].score = 3;
    players[1].score = -1;
    players[2].score = -1;
    players[3].score = -1;
    
    this.setData({ 
      players: players,
      scoreType: 'zimo'
    });
    this.calculateTotal();
  },

  // 快捷设置 - 点炮模板
  quickSetDianpao() {
    const players = this.data.players;
    if (players.length !== 4) {
      wx.showToast({ title: '仅支持4人模板', icon: 'none' });
      return;
    }
    
    // 第一个玩家赢，第二个玩家点炮
    players[0].score = 1;
    players[1].score = -1;
    players[2].score = 0;
    players[3].score = 0;
    
    this.setData({ 
      players: players,
      scoreType: 'dianpao'
    });
    this.calculateTotal();
  },

  // 清空
  clearAll() {
    const players = this.data.players.map(p => ({
      ...p,
      score: 0
    }));
    this.setData({ players });
    this.calculateTotal();
  },

  // 提交分数
  async submitScore() {
    if (this.data.totalScore !== 0) {
      wx.showToast({
        title: '分数总和必须为0',
        icon: 'none'
      });
      return;
    }

    this.setData({ submitting: true });

    try {
      const data = {
        roomId: this.data.roomId,
        roundNo: this.data.roundNo,
        scoreType: this.data.scoreType,
        remark: this.data.remark,
        playerScores: this.data.players.map(p => ({
          userId: p.userId,
          scoreChange: p.score
        }))
      };

      await scoreService.recordScores(data);
      
      wx.showToast({
        title: '记录成功',
        icon: 'success'
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.showToast({
        title: err.message || '记录失败',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
