const app = getApp();
const userService = require('../../services/userService');

Page({
  data: {
    userInfo: {},
    winRate: 0,
    levelName: '雀士'
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const res = await userService.getUserInfo();
      const userInfo = res.data;
      
      // 计算胜率
      const winRate = userInfo.totalGames > 0 
        ? Math.round((userInfo.winGames / userInfo.totalGames) * 100) 
        : 0;
      
      // 等级名称
      const levelNames = ['雀士', '雀杰', '雀豪', '雀圣', '雀神'];
      const levelName = levelNames[Math.min(userInfo.level - 1, 4)] || '雀士';

      this.setData({
        userInfo: userInfo,
        winRate: winRate,
        levelName: levelName
      });

      // 更新全局数据
      app.globalData.userInfo = userInfo;
    } catch (err) {
      console.error('加载用户信息失败:', err);
    }
  },

  // 我的牌局
  goToMyRooms() {
    wx.navigateTo({
      url: '/pages/room/list?type=my'
    });
  },

  // 历史战绩
  goToHistory() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  // 我的好友
  goToFriends() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  // 我的订单
  goToOrders() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  // 编辑资料
  editProfile() {
    wx.showModal({
      title: '编辑昵称',
      editable: true,
      placeholderText: '请输入新昵称',
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            await userService.updateUserInfo({ nickname: res.content });
            wx.showToast({ title: '修改成功', icon: 'success' });
            this.loadUserInfo();
          } catch (err) {
            wx.showToast({ title: '修改失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 绑定手机
  bindPhone() {
    if (this.data.userInfo.phone) {
      wx.showToast({
        title: '已绑定手机',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '绑定手机',
      editable: true,
      placeholderText: '请输入手机号',
      success: async (res) => {
        if (res.confirm && res.content) {
          try {
            await userService.updateUserInfo({ phone: res.content });
            wx.showToast({ title: '绑定成功', icon: 'success' });
            this.loadUserInfo();
          } catch (err) {
            wx.showToast({ title: '绑定失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 关于
  showAbout() {
    wx.showModal({
      title: '关于约麻',
      content: '约麻 v1.0.0\n\n让组局更简单，让娱乐更纯粹',
      showCancel: false
    });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需要重新登录',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          app.globalData.token = null;
          app.globalData.userInfo = null;
          this.setData({
            userInfo: {},
            winRate: 0
          });
          // 不再强制跳转，让用户留在个人中心看到登录按钮
          wx.showToast({ title: '已退出登录', icon: 'none' });
        }
      }
    });
  },

  // 触发登录
  async onLogin() {
    wx.showLoading({ title: '尝试登录...' });
    try {
      // 1. 先尝试静默登录
      const res = await app.login();
      
      if (res.needProfile) {
        // 2. 如果是新用户，才弹出资料完善框
        wx.hideLoading();
        this.setData({
          showLoginModal: true,
          tempNickname: '',
          tempAvatarUrl: ''
        });
      } else {
        // 3. 老用户，直接登录成功
        await this.loadUserInfo();
        wx.hideLoading();
        wx.showToast({ title: '欢迎回来', icon: 'success' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '登录失败', icon: 'none' });
      console.error(err);
    }
  },

  closeLoginModal() {
    this.setData({ showLoginModal: false });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      tempAvatarUrl: avatarUrl
    });
  },

  onNicknameBlur(e) {
    this.setData({
      tempNickname: e.detail.value
    });
  },

  async confirmLogin() {
    const { tempNickname, tempAvatarUrl } = this.data;
    
    if (!tempNickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '登录中...' });
    try {
      await app.login(tempNickname, tempAvatarUrl);
      await this.loadUserInfo();
      this.closeLoginModal();
      wx.hideLoading();
      wx.showToast({ title: '登录成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '登录失败', icon: 'none' });
      console.error(err);
    }
  }
});
