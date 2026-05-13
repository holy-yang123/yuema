# 2026-05-12 约麻小程序前端优化与重构设计文档

## 1. 背景与目标
用户反馈 `yuema-miniprogram` 首页加载存在卡顿，且登录状态及用户信息同步不稳定。本设计旨在通过架构升级和性能优化方案，提升应用响应速度与稳定性，同时完成代码的现代化重构。

## 2. 核心架构设计

### 2.1 响应式状态管理 (`utils/store.js`)
引入一个轻量级的 `EventEmitter` 模式，用于管理全局共享状态（如 `userInfo`, `token`）。
- **功能**：允许页面订阅特定状态的变化。
- **优点**：解耦页面与 `app.globalData` 的手动同步，确保数据实时更新。

### 2.2 全局权限与状态 Behavior (`behaviors/authBehavior.js`)
创建 `authBehavior` 供各页面引用。
- **自动同步**：在 `attached` 生命周期自动订阅 `store`，在 `detached` 时取消订阅。
- **配置化拦截**：支持 `requireAuth: true` 属性，由 Behavior 统一处理未登录跳转。

## 3. 性能优化方案

### 3.1 首页数据预加载 (`app.js`)
- 在 `app.onLaunch` 获取到有效 `token` 后，立即并发发起首页的 `getRoomList` 和 `getNearbyVenues` 请求。
- 将结果存入 `globalData.preloadedData`，并设置有效期（如 30 秒）。

### 3.2 首页请求并发化 (`pages/index/index.js`)
- 改造 `loadData` 函数。
- **逻辑**：优先检查并使用 `preloadedData`。若无，则使用 `Promise.all([getLocation(), getRoomList(), getNearbyVenues()])` 并发执行。

### 3.3 骨架屏实现
- 在首页 WXML 中根据 `loading` 状态展示骨架屏占位元素。
- 使用 CSS 动画（shimmer）提升视觉连续性。

## 4. 重构规范 (`@[/refactor]`)

### 4.1 常量模块化 (`utils/constants.js`)
- **Magic Numbers**：将房间状态、性别、游戏类型等硬编码值提取为常量。
- **Page Routes**：统一管理应用内的页面路径。

### 4.2 语法现代化
- 使用 ES6+ 可选链 (`?.`) 和 空值合并运算符 (`??`) 替换冗余的 `if` 判断。
- 统一使用 `async/await` 处理异步逻辑，替代过深的 `Promise.then`。

## 5. 验收标准
- 首页初次加载及刷新无明显掉帧。
- 用户更新头像或昵称后，首页右上角能即时同步，无需重新进入。
- 代码圈复杂度降低，魔法数字归零。

## 6. 风险评估
- **预加载时效性**：若用户快速切换地理位置，预加载的数据可能过时，需配合 `updateLocation` 的强制更新策略。
- **Behavior 兼容性**：确保基础库版本支持 Behavior 特性。
