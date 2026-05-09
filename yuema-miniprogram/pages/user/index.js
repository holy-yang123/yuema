const app = getApp();
const userService = require('../../services/userService');
const themeUtil = require('../../utils/theme');

/** 个人中心菜单展示用手机号脱敏 */
function maskPhone(phone) {
  const s = String(phone || '').replace(/\s/g, '');
  if (s.length < 7) {
    return '已绑定';
  }
  return `${s.slice(0, 3)}****${s.slice(-4)}`;
}

Page({
  behaviors: [require('../../behaviors/themeBehavior')],
  data: {
    userInfo: {},
    winRate: 0,
    levelName: '雀士',
    /** 弹窗打开后短延迟再允许点头像，降低连点触发「another chooseAvatar is in progress」 */
    avatarPickDelay: false,
    /** 编辑资料弹窗内 chooseAvatar 同样需要短延迟，与登录弹窗独立避免互相干扰 */
    editAvatarPickDelay: false,
    showEditProfileModal: false,
    tempEditNickname: '',
    tempEditAvatarUrl: '',
    /** 绑定手机行右侧文案：未绑定 / 脱敏号码 */
    phoneMenuStatus: '未绑定',
    showLoginModal: false,
    /** 来自登录门禁页完善资料，成功后回首页 Tab */
    fromLoginGate: false
  },

  onLoad(options) {
    const q = options || {};
    if (q.needProfile === '1') {
      this.setData({
        showLoginModal: true,
        tempNickname: '',
        tempAvatarUrl: '',
        avatarPickDelay: true,
        fromLoginGate: q.fromLoginGate === '1'
      });
      setTimeout(() => {
        if (this.data.showLoginModal) {
          this.setData({ avatarPickDelay: false });
        }
      }, 400);
    }
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  /** 个人中心开关：持久化并刷新壳层与本页主题容器（见 utils/theme.js） */
  onThemeDarkChange(e) {
    const mode = e.detail.value ? 'dark' : 'light';
    themeUtil.saveThemeMode(mode);
    themeUtil.applyChrome(mode);
    this.setData(themeUtil.getThemeUIData(mode));
  },

  // 加载用户信息
  async loadUserInfo() {
    if (!app.globalData.token) {
      return;
    }
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

      // 绑定手机菜单状态：已绑定时展示脱敏号码，便于辨认当前账号
      const phoneMenuStatus = userInfo.phone ? maskPhone(userInfo.phone) : '未绑定';

      this.setData({
        userInfo: userInfo,
        winRate: winRate,
        levelName: levelName,
        phoneMenuStatus
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
    if (!app.globalData.token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/user/history'
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

  // 编辑资料：弹窗内同时改昵称与头像（头像为新选的本地临时文件时再上传）
  editProfile() {
    if (!app.globalData.token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    const u = this.data.userInfo || {};
    this.setData({
      showEditProfileModal: true,
      tempEditNickname: u.nickname || '',
      tempEditAvatarUrl: u.avatarUrl || '',
      editAvatarPickDelay: true
    });
    setTimeout(() => {
      if (this.data.showEditProfileModal) {
        this.setData({ editAvatarPickDelay: false });
      }
    }, 400);
  },

  closeEditProfileModal() {
    this.setData({ showEditProfileModal: false });
  },

  onEditChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    if (!avatarUrl) {
      return;
    }
    this.setData({ tempEditAvatarUrl: avatarUrl });
  },

  // bindinput：避免用户改昵称后直接点保存但未触发 blur 导致仍提交旧昵称
  onEditNicknameInput(e) {
    this.setData({ tempEditNickname: e.detail.value });
  },

  async confirmEditProfile() {
    const nick = (this.data.tempEditNickname || '').trim();
    if (!nick) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    if (this._editProfileBusy) {
      return;
    }
    this._editProfileBusy = true;
    wx.showLoading({ title: '保存中...', mask: true });
    try {
      const { tempEditAvatarUrl } = this.data;
      if (tempEditAvatarUrl && app.isTempAvatarPath(tempEditAvatarUrl)) {
        await app.uploadAvatar(tempEditAvatarUrl);
      }
      await userService.updateUserInfo({ nickname: nick });
      await this.loadUserInfo();
      this.closeEditProfileModal();
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
      console.error(err);
    } finally {
      wx.hideLoading();
      this._editProfileBusy = false;
    }
  },

  // 绑定手机；已绑定则二次确认后再走换绑输入
  bindPhone() {
    if (!app.globalData.token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const openPhoneInput = () => {
      const bound = !!this.data.userInfo.phone;
      wx.showModal({
        title: bound ? '换绑手机' : '绑定手机',
        editable: true,
        placeholderText: '请输入11位手机号',
        success: async (res) => {
          if (!res.confirm || !res.content) {
            return;
          }
          const raw = String(res.content).replace(/\s/g, '');
          if (!/^1\d{10}$/.test(raw)) {
            wx.showToast({ title: '手机号格式不正确', icon: 'none' });
            return;
          }
          try {
            await userService.updateUserInfo({ phone: raw });
            wx.showToast({ title: bound ? '换绑成功' : '绑定成功', icon: 'success' });
            this.loadUserInfo();
          } catch (err) {
            wx.showToast({ title: bound ? '换绑失败' : '绑定失败', icon: 'none' });
          }
        }
      });
    };

    if (this.data.userInfo.phone) {
      wx.showModal({
        title: '确认换绑',
        content: '换绑后将改为使用新手机号，请确认是本人操作。',
        confirmText: '继续换绑',
        success: (res) => {
          if (res.confirm) {
            openPhoneInput();
          }
        }
      });
      return;
    }

    openPhoneInput();
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
            winRate: 0,
            phoneMenuStatus: '未绑定'
          });
          // 不再强制跳转，让用户留在个人中心看到登录按钮
          wx.showToast({ title: '已退出登录', icon: 'none' });
        }
      }
    });
  },

  // 触发登录
  async onLogin() {
    if (this._loginBusy) {
      return;
    }
    this._loginBusy = true;
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
          tempAvatarUrl: '',
          avatarPickDelay: true
        });
        setTimeout(() => {
          if (this.data.showLoginModal) {
            this.setData({ avatarPickDelay: false });
          }
        }, 400);
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
    } finally {
      this._loginBusy = false;
    }
  },

  closeLoginModal() {
    this.setData({ showLoginModal: false });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    if (!avatarUrl) {
      return;
    }
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

    if (this._confirmLoginBusy) {
      return;
    }
    this._confirmLoginBusy = true;
    wx.showLoading({ title: '登录中...', mask: true });
    try {
      // 临时本地路径不要写入登录接口（无法持久化）；其它非临时 URL 可随登录一次写入
      const loginAvatar = app.isTempAvatarPath(tempAvatarUrl) ? null : tempAvatarUrl || null;
      await app.login(tempNickname, loginAvatar);

      if (tempAvatarUrl && app.isTempAvatarPath(tempAvatarUrl)) {
        try {
          await app.uploadAvatar(tempAvatarUrl);
        } catch (upErr) {
          console.error('头像上传失败:', upErr);
          wx.showToast({
            title: typeof upErr === 'string' ? upErr : '头像上传失败，可稍后重试',
            icon: 'none',
            duration: 2500
          });
        }
      }

      await this.loadUserInfo();
      this.closeLoginModal();
      wx.showToast({ title: '登录成功', icon: 'success' });
      if (this.data.fromLoginGate) {
        this.setData({ fromLoginGate: false });
        wx.switchTab({
          url: '/pages/index/index'
        });
      }
    } catch (err) {
      wx.showToast({ title: '登录失败', icon: 'none' });
      console.error(err);
    } finally {
      wx.hideLoading();
      this._confirmLoginBusy = false;
    }
  }
});
