# 2026-05-12 前端优化实施计划 (Frontend Optimization Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决 `yuema-miniprogram` 首页加载卡顿及用户信息同步不稳定问题，并完成代码现代化重构。

**Architecture:** 引入轻量级 Store 模式实现响应式状态同步，利用 Behavior 统一页面权限，通过数据预加载与 Promise.all 实现首页极速加载。

**Tech Stack:** 微信小程序 (Native), ES6+, CSS Animations.

---

### Task 1: 响应式状态管理与 Behavior 基座

**Files:**
- Create: `f:/workspace/约麻/ymapp/yuema-miniprogram/utils/store.js`
- Create: `f:/workspace/约麻/ymapp/yuema-miniprogram/behaviors/authBehavior.js`

- [ ] **Step 1: 实现 utils/store.js**

```javascript
class Store {
  constructor() {
    this.state = {
      userInfo: null,
      token: null
    };
    this.listeners = [];
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    // 立即执行一次以同步当前状态
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(l => l(this.state));
  }
}

module.exports = new Store();
```

- [ ] **Step 2: 实现 behaviors/authBehavior.js**

```javascript
const store = require('../utils/store');
const { LOGIN_PAGE } = require('../utils/pageRoutes');

module.exports = Behavior({
  data: {
    userInfo: {},
    isLoggedIn: false
  },
  lifetimes: {
    attached() {
      this._unsubscribe = store.subscribe((state) => {
        this.setData({
          userInfo: state.userInfo || {},
          isLoggedIn: !!state.token
        });
        
        // 如果页面要求登录且当前未登录，则跳转
        if (this.data.requireAuth && !state.token) {
          wx.reLaunch({ url: LOGIN_PAGE });
        }
      });
    },
    detached() {
      if (this._unsubscribe) this._unsubscribe();
    }
  }
});
```

- [ ] **Step 3: 提交代码**

```bash
git add yuema-miniprogram/utils/store.js yuema-miniprogram/behaviors/authBehavior.js
git commit -m "feat: add store and authBehavior for state synchronization"
```

---

### Task 2: 常量提取与请求层优化

**Files:**
- Create: `f:/workspace/约麻/ymapp/yuema-miniprogram/utils/constants.js`
- Modify: `f:/workspace/约麻/ymapp/yuema-miniprogram/utils/request.js`

- [ ] **Step 1: 创建 utils/constants.js**

```javascript
module.exports = {
  ROOM_STATUS: {
    WAITING: 0,
    PLAYING: 1,
    FINISHED: 2
  },
  GAME_TYPES: {
    MAHJONG: 'mahjong',
    POKER: 'poker'
  },
  HTTP_CODE: {
    SUCCESS: 200,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404
  }
};
```

- [ ] **Step 2: 优化 utils/request.js 整合 Store**

```javascript
const store = require('./store');
const { clearAuthAndGoLogin } = require('./authRedirect');
const { HTTP_CODE } = require('./constants');

// 修改 request 函数内部 header 部分
// ...
header: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${store.state.token || ''}`,
  ...options.header
},
// ...
// 修改 success 回调中的状态判断
if (res.statusCode === HTTP_CODE.SUCCESS) {
  // ...
} else if (res.statusCode === HTTP_CODE.UNAUTHORIZED) {
  // ...
}
```

- [ ] **Step 3: 提交代码**

```bash
git add yuema-miniprogram/utils/constants.js yuema-miniprogram/utils/request.js
git commit -m "refactor: extract constants and integrate store into request layer"
```

---

### Task 3: 预加载逻辑集成 (App.js)

**Files:**
- Modify: `f:/workspace/约麻/ymapp/yuema-miniprogram/app.js`

- [ ] **Step 1: 修改 app.js 引入 store 并实现预加载**

```javascript
const store = require('./utils/store');
const roomService = require('./services/roomService');
const venueService = require('./services/venueService');

App({
  globalData: {
    // ...
    preloadedData: null,
    preloadTimestamp: 0
  },

  onLaunch(options) {
    // ... (保持原有的 theme/font 逻辑)
    
    // 初始化 store 状态
    const token = wx.getStorageSync('token');
    if (token) {
      store.setState({ token });
      this.getUserInfo().then(() => {
        this.preloadIndexData(); // 用户登录后立即预加载
      });
    }
  },

  async preloadIndexData() {
    try {
      const loc = await this.updateLocation();
      const [rooms, venues] = await Promise.all([
        roomService.getRoomList(loc?.longitude, loc?.latitude),
        venueService.getNearbyVenues(loc?.longitude, loc?.latitude, 5)
      ]);
      this.globalData.preloadedData = { rooms, venues };
      this.globalData.preloadTimestamp = Date.now();
    } catch (e) {
      console.error('Preload failed', e);
    }
  },

  getUserInfo() {
    return http.get('/user/info').then((body) => {
      store.setState({ userInfo: body.data });
      return body.data;
    });
  }
});
```

- [ ] **Step 2: 提交代码**

```bash
git add yuema-miniprogram/app.js
git commit -m "feat: implement data preloading in app.js"
```

---

### Task 4: 首页并发与重构 (Index.js)

**Files:**
- Modify: `f:/workspace/约麻/ymapp/yuema-miniprogram/pages/index/index.js`

- [ ] **Step 1: 整合 authBehavior 并优化 loadData**

```javascript
const authBehavior = require('../../behaviors/authBehavior');

Page({
  behaviors: [require('../../behaviors/themeBehavior'), authBehavior],
  data: {
    // ...
    requireAuth: true // Behavior 自动处理拦截
  },

  async loadData() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    // 检查预加载（30秒内有效）
    const { preloadedData, preloadTimestamp } = app.globalData;
    if (preloadedData && (Date.now() - preloadTimestamp < 30000)) {
       this.applyData(preloadedData.rooms, preloadedData.venues);
       app.globalData.preloadedData = null; // 消费后清除
       return;
    }

    try {
      const loc = await app.updateLocation();
      const [roomRes, venueRes] = await Promise.all([
        roomService.getRoomList(loc?.longitude, loc?.latitude),
        loc ? venueService.getNearbyVenues(loc.longitude, loc.latitude, 5) : venueService.getVenueList()
      ]);
      this.applyData(roomRes, venueRes);
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  applyData(roomRes, venueRes) {
    const roomList = (roomRes.data || []).slice(0, 5).map(r => ({
      ...attachScheduleDisplay(r),
      ruleCardTags: buildRuleCardTags(r)
    }));
    const venueList = (venueRes.data || []).slice(0, 5);
    this.setData({
      roomList,
      venueList,
      loading: false
    });
  }
});
```

- [ ] **Step 2: 提交代码**

```bash
git add yuema-miniprogram/pages/index/index.js
git commit -m "perf: optimize index page with parallel loading and preloading"
```

---

### Task 5: 骨架屏实现 (UI)

**Files:**
- Modify: `f:/workspace/约麻/ymapp/yuema-miniprogram/pages/index/index.wxml`
- Modify: `f:/workspace/约麻/ymapp/yuema-miniprogram/pages/index/index.wxss`

- [ ] **Step 1: 编写 WXSS 动画**

```css
.skeleton {
  background: #f2f2f2;
  border-radius: 8rpx;
  position: relative;
  overflow: hidden;
}
.skeleton::after {
  content: "";
  position: absolute;
  top: 0; left: -100%;
  width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  100% { left: 100%; }
}
```

- [ ] **Step 2: 编写 WXML 占位**

```xml
<view wx:if="{{loading}}" class="skeleton-container">
  <view class="skeleton" style="height: 200rpx; margin-bottom: 20rpx;"></view>
  <view class="skeleton" style="height: 200rpx; margin-bottom: 20rpx;"></view>
</view>
<view wx:else>
  <!-- 原始列表内容 -->
</view>
```

- [ ] **Step 3: 提交代码**

```bash
git add yuema-miniprogram/pages/index/index.wxml yuema-miniprogram/pages/index/index.wxss
git commit -m "ui: add skeleton screen for index page"
```
