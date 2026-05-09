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
        const snap = this.buildModifySnapshot(merged);
        const totalScore = merged.reduce((s, p) => s + p.score, 0);
        // 一次 setData：减少布局与与 data 不同步风险
        this.setData({
          players: merged,
          isOwner,
          roundLocked: true,
          scoreType: existing[0].scoreType || this.data.scoreType,
          remark: existing[0].remark || '',
          modifyPlayers: snap.modifyPlayers,
          modifyTotal: snap.modifyTotal,
          totalScore
        });
      } else {
        this.setData({
          players: members,
          isOwner,
          roundLocked: false,
          totalScore: 0
        });
      }
    } catch (err) {
      console.error('加载成员失败:', err);
    }
  },

  /** 由 players 派生修改弹层数据，不触发 setData，供合并更新使用 */
  buildModifySnapshot(players) {
    const modifyPlayers = players.map((p) => ({
      userId: p.userId,
      nickname: p.nickname,
      avatarUrl: p.avatarUrl,
      score: p.score
    }));
    const modifyTotal = modifyPlayers.reduce((s, p) => s + p.score, 0);
    return { modifyPlayers, modifyTotal };
  },

  openModifyModal() {
    const snap = this.buildModifySnapshot(this.data.players);
    this.setData({
      showModifyModal: true,
      modifyPlayers: snap.modifyPlayers,
      modifyTotal: snap.modifyTotal
    });
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
    // 拷贝后再改，避免直接改 this.data 引用导致渲染/逻辑异常
    const players = this.data.players.map((p, i) => {
      if (i !== index) {
        return p;
      }
      const cur = p.score;
      const next = cur >= 0 ? score : -score;
      return { ...p, score: next };
    });
    const totalScore = players.reduce((sum, p) => sum + p.score, 0);
    this.setData({ players, totalScore });
  },

  toggleSign(e) {
    const index = e.currentTarget.dataset.index;
    const players = this.data.players.map((p, i) =>
      i === index ? { ...p, score: -p.score } : p
    );
    const totalScore = players.reduce((sum, p) => sum + p.score, 0);
    this.setData({ players, totalScore });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  onModifyScoreInput(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const score = value === '' ? 0 : parseInt(value, 10);
    const modifyPlayers = this.data.modifyPlayers.map((p, i) => {
      if (i !== index) {
        return p;
      }
      const cur = p.score;
      const next = cur >= 0 ? score : -score;
      return { ...p, score: next };
    });
    const modifyTotal = modifyPlayers.reduce((s, p) => s + p.score, 0);
    this.setData({ modifyPlayers, modifyTotal });
  },

  toggleModifySign(e) {
    const index = e.currentTarget.dataset.index;
    const modifyPlayers = this.data.modifyPlayers.map((p, i) =>
      i === index ? { ...p, score: -p.score } : p
    );
    const modifyTotal = modifyPlayers.reduce((s, p) => s + p.score, 0);
    this.setData({ modifyPlayers, modifyTotal });
  },

  quickSetZimo() {
    const base = this.data.players;
    if (base.length !== 4) {
      wx.showToast({ title: '仅支持4人模板', icon: 'none' });
      return;
    }
    const template = [3, -1, -1, -1];
    const players = base.map((p, i) => ({ ...p, score: template[i] }));
    const totalScore = 0;
    this.setData({ players, scoreType: 'zimo', totalScore });
  },

  quickSetDianpao() {
    const base = this.data.players;
    if (base.length !== 4) {
      wx.showToast({ title: '仅支持4人模板', icon: 'none' });
      return;
    }
    const template = [1, -1, 0, 0];
    const players = base.map((p, i) => ({ ...p, score: template[i] }));
    const totalScore = 0;
    this.setData({ players, scoreType: 'dianpao', totalScore });
  },

  clearAll() {
    const players = this.data.players.map((p) => ({
      ...p,
      score: 0
    }));
    this.setData({ players, totalScore: 0 });
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
