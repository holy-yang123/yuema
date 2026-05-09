const app = getApp();
const roomService = require('../../services/roomService');
const scoreService = require('../../services/scoreService');

Page({
  behaviors: [require('../../behaviors/themeBehavior')],
  data: {
    roomId: null,
    roundNo: 1,
    players: [],
    scoreType: 'zimo',
    remark: '',
    totalScore: 0,
    submitting: false,
    isOwner: false,
    roundLocked: false,
    showModifyModal: false,
    modifyPlayers: [],
    modifyTotal: 0,
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
      roomId: parseInt(options.roomId, 10),
      roundNo: parseInt(options.roundNo, 10) || 1
    });
    this.loadRoomAndRound();
  },

  async loadRoomAndRound() {
    try {
      const res = await roomService.getRoomInfo(this.data.roomId);
      const u = app.globalData.userInfo;
      const uid = u ? (u.userId != null ? u.userId : u.id) : null;
      const isOwner = res.data.members.some((m) => m.userId === uid && m.role === 1);
      const members = res.data.members.map((m) => ({
        userId: m.userId,
        nickname: m.nickname,
        avatarUrl: m.avatarUrl,
        score: 0
      }));
      this.setData({ players: members, isOwner });

      const roundRes = await scoreService.getRoundScores(this.data.roomId, this.data.roundNo);
      const existing = roundRes.data || [];
      if (existing.length > 0) {
        const byUser = {};
        existing.forEach((r) => {
          byUser[r.userId] = r.scoreChange;
        });
        const merged = members.map((p) => ({
          ...p,
          score: byUser[p.userId] != null ? byUser[p.userId] : 0
        }));
        this.setData({
          players: merged,
          roundLocked: true,
          scoreType: existing[0].scoreType || this.data.scoreType,
          remark: existing[0].remark || ''
        });
        this.calculateTotal();
        this.buildModifyPlayersFrom(merged);
      } else {
        this.setData({ roundLocked: false });
        this.calculateTotal();
      }
    } catch (err) {
      console.error('加载成员失败:', err);
    }
  },

  buildModifyPlayersFrom(players) {
    const modifyPlayers = players.map((p) => ({
      userId: p.userId,
      nickname: p.nickname,
      avatarUrl: p.avatarUrl,
      score: p.score
    }));
    const modifyTotal = modifyPlayers.reduce((s, p) => s + p.score, 0);
    this.setData({ modifyPlayers, modifyTotal });
  },

  openModifyModal() {
    this.buildModifyPlayersFrom(this.data.players);
    this.setData({ showModifyModal: true });
  },

  closeModifyModal() {
    this.setData({ showModifyModal: false });
  },

  selectScoreType(e) {
    this.setData({ scoreType: e.currentTarget.dataset.value });
  },

  onScoreInput(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const score = value === '' ? 0 : parseInt(value, 10);
    const players = this.data.players;
    const currentScore = players[index].score;
    players[index].score = currentScore >= 0 ? score : -score;
    this.setData({ players });
    this.calculateTotal();
  },

  calculateTotal() {
    const total = this.data.players.reduce((sum, p) => sum + p.score, 0);
    this.setData({ totalScore: total });
  },

  toggleSign(e) {
    const index = e.currentTarget.dataset.index;
    const players = this.data.players;
    players[index].score = -players[index].score;
    this.setData({ players });
    this.calculateTotal();
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  onModifyScoreInput(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const score = value === '' ? 0 : parseInt(value, 10);
    const modifyPlayers = this.data.modifyPlayers;
    const currentScore = modifyPlayers[index].score;
    modifyPlayers[index].score = currentScore >= 0 ? score : -score;
    const modifyTotal = modifyPlayers.reduce((s, p) => s + p.score, 0);
    this.setData({ modifyPlayers, modifyTotal });
  },

  toggleModifySign(e) {
    const index = e.currentTarget.dataset.index;
    const modifyPlayers = this.data.modifyPlayers;
    modifyPlayers[index].score = -modifyPlayers[index].score;
    const modifyTotal = modifyPlayers.reduce((s, p) => s + p.score, 0);
    this.setData({ modifyPlayers, modifyTotal });
  },

  quickSetZimo() {
    const players = this.data.players;
    if (players.length !== 4) {
      wx.showToast({ title: '仅支持4人模板', icon: 'none' });
      return;
    }
    players[0].score = 3;
    players[1].score = -1;
    players[2].score = -1;
    players[3].score = -1;
    this.setData({
      players,
      scoreType: 'zimo'
    });
    this.calculateTotal();
  },

  quickSetDianpao() {
    const players = this.data.players;
    if (players.length !== 4) {
      wx.showToast({ title: '仅支持4人模板', icon: 'none' });
      return;
    }
    players[0].score = 1;
    players[1].score = -1;
    players[2].score = 0;
    players[3].score = 0;
    this.setData({
      players,
      scoreType: 'dianpao'
    });
    this.calculateTotal();
  },

  clearAll() {
    const players = this.data.players.map((p) => ({
      ...p,
      score: 0
    }));
    this.setData({ players });
    this.calculateTotal();
  },

  async submitScore() {
    if (this.data.roundLocked) {
      wx.showToast({ title: '本局已有分数，请用修改流程', icon: 'none' });
      return;
    }
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
        playerScores: this.data.players.map((p) => ({
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
      if (err && err.code === 409) {
        wx.showToast({ title: '该局已有记分', icon: 'none' });
        this.setData({ roundLocked: true });
        this.loadRoomAndRound();
      } else {
        wx.showToast({
          title: (err && err.message) || '记录失败',
          icon: 'none'
        });
      }
    } finally {
      this.setData({ submitting: false });
    }
  },

  async submitModify() {
    if (this.data.modifyTotal !== 0) {
      wx.showToast({ title: '修改分数总和须为0', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await scoreService.modifyRequest({
        roomId: this.data.roomId,
        roundNo: this.data.roundNo,
        scoreType: this.data.scoreType,
        remark: this.data.remark,
        playerScores: this.data.modifyPlayers.map((p) => ({
          userId: p.userId,
          scoreChange: p.score
        }))
      });
      wx.showToast({ title: '已发起确认', icon: 'success' });
      this.closeModifyModal();
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (err) {
      wx.showToast({
        title: (err && err.message) || '发起失败',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
