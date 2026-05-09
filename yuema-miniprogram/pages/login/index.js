const app = getApp();
const theme = require('../../utils/theme');

/** 固定种子：同 seed 下粒子初始分布一致，体现可控随机 */
const BG_SEED = 20240509;

function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

Page({
  data: {
    loading: false,
    btnPressed: false,
    /** 登录页不用 themeBehavior：避免每次 onShow setData 导致 2d canvas 与入场动画异常（返回后约 1s 空白） */
    themeScopeClass: 'theme-scope',
    themeMeta: {
      rootBg: '#faf9f5',
      bg: '#faf9f5',
      bgBottom: '#faf9f5',
      textStyle: 'dark'
    }
  },

  _running: false,
  _canvasNode: null,
  _ctx: null,
  _w: 0,
  _h: 0,
  _particles: [],
  /** 与存储对比，仅切换主题时才 setData，减少整页重绘 */
  _lastAppliedThemeMode: null,
  /** onReady 已执行：区分首次（仅 onReady 绑 canvas）与再次 onShow（栈返回需重绑） */
  _pageReady: false,

  onLoad() {
    this._pageReady = false;
    const m = theme.getThemeMode();
    theme.applyChrome(m);
    this._lastAppliedThemeMode = m;
    this.setData(theme.getThemeUIData(m));
  },

  onShow() {
    // 清除全局 loading：其它页 reLaunch/异常路径可能未 hide，mask 默认 false 时仍可点到下层，表现为「只有登录中遮罩」
    wx.hideLoading();
    const m = theme.getThemeMode();
    theme.applyChrome(m);
    if (m !== this._lastAppliedThemeMode) {
      this._lastAppliedThemeMode = m;
      this.setData(theme.getThemeUIData(m));
    }
    if (app.globalData.token) {
      wx.switchTab({
        url: '/pages/index/index'
      });
      return;
    }
    // 首次绑定交给 onReady，避免与 onShow 各调一次 _bindCanvasAndStart；仅页面已就绪后（再次 onShow）才重绑，应对 canvas 被系统回收
    if (this._pageReady) {
      wx.nextTick(() => {
        this._bindCanvasAndStart();
      });
    }
  },

  onReady() {
    this._pageReady = true;
    this._bindCanvasAndStart();
  },

  onHide() {
    this._stopBgLoop();
  },

  onUnload() {
    this._stopBgLoop();
    this._canvasBindRetries = 0;
    // 离开登录栈时收起可能未配对的 showLoading，避免返回其它页面仍盖着遮罩
    wx.hideLoading();
  },

  /** type=2d canvas：每次绑定前先停环，避免返回页面后双 RAF 或失效上下文 */
  _bindCanvasAndStart() {
    this._stopBgLoop();
    const query = wx.createSelectorQuery().in(this);
    query
      .select('#login-bg')
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res && res[0];
        if (!info || !info.node || !info.width || !info.height) {
          if (!this._canvasBindRetries) {
            this._canvasBindRetries = 0;
          }
          if (this._canvasBindRetries < 8) {
            this._canvasBindRetries += 1;
            setTimeout(() => this._bindCanvasAndStart(), 50);
          }
          return;
        }
        this._canvasBindRetries = 0;
        const canvas = info.node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio || 1;
        const w = info.width;
        const h = info.height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        this._canvasNode = canvas;
        this._ctx = ctx;
        this._w = w;
        this._h = h;
        this._particles = this._makeParticles(w, h);
        this._startBgLoop();
      });
  },

  _makeParticles(w, h) {
    const rand = mulberry32(BG_SEED);
    const n = 52;
    const list = [];
    const orange = 'rgba(217, 119, 87, 0.2)';
    const blue = 'rgba(106, 155, 204, 0.16)';
    const green = 'rgba(120, 140, 93, 0.14)';
    for (let i = 0; i < n; i++) {
      const roll = rand();
      const color = roll > 0.62 ? orange : roll > 0.28 ? blue : green;
      list.push({
        x: rand() * w,
        y: rand() * h,
        r: 1.1 + rand() * 2.4,
        vx: (rand() - 0.5) * 0.35,
        vy: (rand() - 0.5) * 0.35,
        color
      });
    }
    return list;
  },

  _drawFrame(tMs) {
    const ctx = this._ctx;
    const w = this._w;
    const h = this._h;
    if (!ctx || !w || !h) {
      return;
    }
    // 与当前主题背景一致（深色下勿铺浅色底盖住上层视觉）
    const dark = theme.getThemeMode() === 'dark';
    const bg = ctx.createLinearGradient(0, 0, w, h);
    if (dark) {
      bg.addColorStop(0, '#262624');
      bg.addColorStop(0.5, '#1c1c1a');
      bg.addColorStop(1, '#181816');
    } else {
      bg.addColorStop(0, '#fdfcfa');
      bg.addColorStop(0.5, '#faf8f2');
      bg.addColorStop(1, '#f2ebe2');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const t = tMs * 0.00012;
    const parts = this._particles;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const angle =
        Math.sin(p.x * 0.0028 + t) * Math.cos(p.y * 0.0028 - t * 0.65) * 6.28318;
      p.x += Math.cos(angle) * 0.85 + p.vx * 0.03;
      p.y += Math.sin(angle) * 0.85 + p.vy * 0.03;
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
  },

  _startBgLoop() {
    if (this._running || !this._canvasNode) {
      return;
    }
    this._running = true;
    const canvas = this._canvasNode;
    const loop = (now) => {
      if (!this._running) {
        return;
      }
      this._drawFrame(typeof now === 'number' ? now : Date.now());
      canvas.requestAnimationFrame(loop);
    };
    canvas.requestAnimationFrame(loop);
  },

  _stopBgLoop() {
    this._running = false;
  },

  onBtnTouchStart() {
    this.setData({ btnPressed: true });
  },

  onBtnTouchEnd() {
    this.setData({ btnPressed: false });
  },

  async onWxLogin() {
    if (this.data.loading) {
      return;
    }
    this.setData({ loading: true });
    wx.showLoading({ title: '登录中...' });
    try {
      const res = await app.login();
      wx.hideLoading();
      if (res.needProfile) {
        // redirectTo 不能打开 tabBar 页面，首次登录会静默失败卡死在登录栈；reLaunch 可带 query 打开「我的」
        wx.reLaunch({
          url: '/pages/user/index?needProfile=1&fromLoginGate=1'
        });
      } else {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '登录失败', icon: 'none' });
      console.error(err);
    } finally {
      this.setData({ loading: false });
    }
  }
});
