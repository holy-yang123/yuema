const userService = require('../../services/userService');
const app = getApp();

Page({
  behaviors: [require('../../behaviors/themeBehavior')],
  data: {
    stats: {
      totalGames: 0,
      winGames: 0,
      score: 0,
      winRate: 0
    },
    records: [],
    current: 1,
    pages: 1,
    loading: false,
    gameTypeMap: {
      sichuan: '四川麻将',
      guobiao: '国标麻将',
      guangdong: '广东麻将'
    },
    shareRecord: null
  },

  onLoad() {
    if (!app.globalData.token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    try {
      wx.showShareMenu({ menus: ['shareAppMessage'] });
    } catch (e) {
      // ignore
    }
    this.loadStats();
    this.loadRecords(true);
  },

  prepareShareRecord(e) {
    const idx = e.currentTarget.dataset.index;
    const r = this.data.records[idx];
    this.setData({ shareRecord: r || null });
  },

  onShareAppMessage() {
    const r = this.data.shareRecord;
    if (r && r.roomId) {
      const gt = this.data.gameTypeMap[r.gameType] || r.gameType || '麻将';
      const sc = r.finalScore != null ? r.finalScore : 0;
      const sign = sc > 0 ? '+' : '';
      return {
        title: `约麻战绩：${gt} ${sign}${sc}分`,
        path: `/pages/room/detail?id=${r.roomId}`
      };
    }
    return {
      title: '约麻 — 历史战绩',
      path: '/pages/index/index'
    };
  },

  onReachBottom() {
    if (this.data.current < this.data.pages && !this.data.loading) {
      this.loadRecords(false);
    }
  },

  async loadStats() {
    try {
      const res = await userService.getStats();
      this.setData({ stats: res.data || this.data.stats });
    } catch (err) {
      console.error('stats', err);
    }
  },

  async loadRecords(reset) {
    if (this.data.loading) {
      return;
    }
    const next = reset ? 1 : this.data.current + 1;
    this.setData({ loading: true });
    try {
      const res = await userService.getGameRecords(next, 15);
      const page = res.data || {};
      const list = (page.records || []).map((r) => ({
        ...r,
        endedAtShort: r.endedAt ? String(r.endedAt).slice(0, 16) : ''
      }));
      const merged = reset ? list : this.data.records.concat(list);
      this.setData({
        records: merged,
        current: page.current != null ? page.current : next,
        pages: page.pages != null ? page.pages : 1
      });
    } catch (err) {
      console.error('game-records', err);
    } finally {
      this.setData({ loading: false });
    }
  },

});
