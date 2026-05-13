const app = getApp();
const userService = require('../../services/userService');
const themeUtil = require('../../utils/theme');
const store = require('../../utils/store');
const authBehavior = require('../../behaviors/authBehavior');

/** 个人中心菜单展示用手机号脱敏 */
function maskPhone(phone) {
  const s = String(phone || '').replace(/\s/g, '');
  if (s.length < 7) {
    return '已绑定';
  }
  return `${s.slice(0, 3)}****${s.slice(-4)}`;
}

Component({
  behaviors: [
    require('../../behaviors/themeBehavior'),
    authBehavior
  ],
  data: {
    userInfo: {},
    winRate: 0,
    levelName: '雀士',
    avatarPickDelay: false,
    editAvatarPickDelay: false,
    showEditProfileModal: false,
    tempEditNickname: '',
    tempEditAvatarUrl: '',
    phoneMenuStatus: '未绑定',
    trustSummary: { reputation: 100, verified: false, realnameText: '未实名核验' },
    showWxRealnameModal: false,
    showLoginModal: false,
    fromLoginGate: false,
    tempNickname: '',
    tempAvatarUrl: ''
  },

  observers: {
    'userInfo': function(userInfo) {
      // 与 authBehavior 一致：登录态以 id 或 userId 为准，避免仅同步了登录返回体时衍生字段不更新
      const uid = userInfo && (userInfo.id != null ? userInfo.id : userInfo.userId);
      if (!userInfo || uid == null) return;
      this.applyUserInfoDerivedData(userInfo);
    }
  },

  /** 页面生命周期 - 加载 */
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
  },

  /** 页面生命周期 - 展示 */
  async onShow() {
    if (!this.data.isLoggedIn) {
      return;
    }
    // 显式 await 后同步衍生字段：避免仅依赖 observers 时，/user/info 返回后 phoneMenuStatus/胜率等仍不刷新
    try {
      await app.getUserInfo();
    } catch (e) {
      console.error('onShow 刷新用户信息失败:', e);
    }
    const raw = store.state.userInfo || {};
    const u =
      raw && (raw.id != null || raw.userId != null)
        ? { ...raw, id: raw.id != null ? raw.id : raw.userId }
        : null;
    if (u && u.id != null) {
      this.applyUserInfoDerivedData(u);
    }
  },

  methods: {
    /** 计算用户信息相关的衍生展示数据 */
    applyUserInfoDerivedData(userInfo) {
      const winRate = userInfo.totalGames > 0 
        ? Math.round((userInfo.winGames / userInfo.totalGames) * 100) 
        : 0;
      
      const levelNames = ['雀士', '雀杰', '雀豪', '雀圣', '雀神'];
      const lv = Number(userInfo.level);
      const safeLevel = Number.isFinite(lv) ? lv : 1;
      const levelIdx = Math.min(Math.max(safeLevel - 1, 0), 4);
      const levelName = levelNames[levelIdx] || '雀士';

      const phoneMenuStatus = userInfo.phone ? maskPhone(userInfo.phone) : '未绑定';

      const rep = userInfo.reputationScore != null ? userInfo.reputationScore : 100;
      const verified = userInfo.realnameVerified === 1;
      const trustSummary = {
        reputation: rep,
        verified,
        realnameText: verified ? '已微信核验' : '未实名核验'
      };

      this.setData({
        winRate,
        levelName,
        phoneMenuStatus,
        trustSummary
      });
    },

    /** 刷新用户信息 */
    async loadUserInfo() {
      if (!this.data.isLoggedIn) return;
      try {
        await app.getUserInfo();
      } catch (err) {
        console.error('加载用户信息失败:', err);
      }
    },

    /** 主题切换 */
    onThemeDarkChange(e) {
      const mode = e.detail.value ? 'dark' : 'light';
      themeUtil.saveThemeMode(mode);
      themeUtil.applyChrome(mode);
      this.setData(themeUtil.getThemeUIData(mode));
    },

    goToMyRooms() {
      if (!this.data.isLoggedIn) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      wx.navigateTo({ url: '/pages/room/list?type=my' });
    },

    goToHistory() {
      if (!this.data.isLoggedIn) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      wx.navigateTo({ url: '/pages/user/history' });
    },

    goToFriends() {
      wx.navigateTo({
        url: `/pages/misc/placeholder?title=${encodeURIComponent('我的好友')}&subtitle=${encodeURIComponent('好友相关能力即将上线，敬请期待')}`
      });
    },

    goToOrders() {
      wx.navigateTo({
        url: `/pages/misc/placeholder?title=${encodeURIComponent('我的订单')}&subtitle=${encodeURIComponent('订单与支付相关能力即将上线，敬请期待')}`
      });
    },

    editProfile() {
      if (!this.data.isLoggedIn) {
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
      if (!avatarUrl) return;
      this.setData({ tempEditAvatarUrl: avatarUrl });
    },

    onEditNicknameInput(e) {
      this.setData({ tempEditNickname: e.detail.value });
    },

    async confirmEditProfile() {
      const nick = (this.data.tempEditNickname || '').trim();
      if (!nick) {
        wx.showToast({ title: '请输入昵称', icon: 'none' });
        return;
      }
      if (this._editProfileBusy) return;
      this._editProfileBusy = true;
      wx.showLoading({ title: '保存中...', mask: true });
      try {
        const { tempEditAvatarUrl } = this.data;
        if (tempEditAvatarUrl && app.isTempAvatarPath(tempEditAvatarUrl)) {
          await app.uploadAvatar(tempEditAvatarUrl);
        }
        await userService.updateUserInfo({ nickname: nick });
        await app.getUserInfo(); // 刷新 store
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

    openWxRealnameModal() {
      if (!this.data.isLoggedIn) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      this.setData({ showWxRealnameModal: true });
    },

    closeWxRealnameModal() {
      this.setData({ showWxRealnameModal: false });
    },

    async onWxPhoneForRealname(e) {
      const d = (e && e.detail) || {};
      if (d.errMsg && d.errMsg.indexOf('fail') >= 0) {
        wx.showToast({ title: '授权失败', icon: 'none' });
        return;
      }
      const code = d.code;
      if (!code) return;
      wx.showLoading({ title: '校验中', mask: true });
      try {
        await userService.bindWxPhone({ code });
        wx.showToast({ title: '认证成功', icon: 'success' });
        this.setData({ showWxRealnameModal: false });
        await app.getUserInfo();
      } catch (err) {
        wx.showToast({ title: (err && err.message) || '失败', icon: 'none' });
      } finally {
        wx.hideLoading();
      }
    },

    bindPhone() {
      if (!this.data.isLoggedIn) {
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
            if (!res.confirm || !res.content) return;
            const raw = String(res.content).replace(/\s/g, '');
            if (!/^1\d{10}$/.test(raw)) {
              wx.showToast({ title: '手机号格式不正确', icon: 'none' });
              return;
            }
            try {
              await userService.updateUserInfo({ phone: raw });
              wx.showToast({ title: bound ? '换绑成功' : '绑定成功', icon: 'success' });
              app.getUserInfo();
            } catch (err) {
              wx.showToast({ title: '操作失败', icon: 'none' });
            }
          }
        });
      };
      if (this.data.userInfo.phone) {
        wx.showModal({
          title: '确认换绑',
          content: '换绑后将改为使用新手机号',
          confirmText: '继续换绑',
          success: (res) => {
            if (res.confirm) openPhoneInput();
          }
        });
        return;
      }
      openPhoneInput();
    },

    showAbout() {
      wx.showModal({
        title: '关于约麻',
        content: '约麻 v1.0.0\n\n让组局更简单，让娱乐更纯粹',
        showCancel: false
      });
    },

    logout() {
      wx.showModal({
        title: '确认退出',
        content: '退出后需要重新登录',
        success: (res) => {
          if (res.confirm) {
            wx.removeStorageSync('token');
            store.setState({ token: null, userInfo: null });
            this.setData({
              winRate: 0,
              levelName: '雀士',
              phoneMenuStatus: '未绑定',
              trustSummary: { reputation: 100, verified: false, realnameText: '未实名核验' }
            });
            wx.showToast({ title: '已退出登录', icon: 'none' });
          }
        }
      });
    },

    async onLogin() {
      if (this._loginBusy) return;
      this._loginBusy = true;
      wx.showLoading({ title: '尝试登录...' });
      try {
        const res = await app.login();
        if (res.needProfile) {
          wx.hideLoading();
          this.setData({
            showLoginModal: true,
            tempNickname: '',
            tempAvatarUrl: '',
            avatarPickDelay: true
          });
          setTimeout(() => {
            if (this.data.showLoginModal) this.setData({ avatarPickDelay: false });
          }, 400);
        } else {
          await app.getUserInfo();
          wx.hideLoading();
          wx.showToast({ title: '欢迎回来', icon: 'success' });
        }
      } catch (err) {
        wx.hideLoading();
        wx.showToast({ title: '登录失败', icon: 'none' });
      } finally {
        this._loginBusy = false;
      }
    },

    closeLoginModal() {
      this.setData({ showLoginModal: false });
    },

    onChooseAvatar(e) {
      const { avatarUrl } = e.detail;
      if (!avatarUrl) return;
      this.setData({ tempAvatarUrl: avatarUrl });
    },

    onNicknameBlur(e) {
      this.setData({ tempNickname: e.detail.value });
    },

    onLoginNicknameInput(e) {
      this.setData({ tempNickname: e.detail.value });
    },

    async confirmLogin() {
      const nick = (this.data.tempNickname || '').trim();
      const tempAvatarUrl = this.data.tempAvatarUrl;
      if (!nick) {
        wx.showToast({ title: '请输入昵称', icon: 'none' });
        return;
      }
      if (this._confirmLoginBusy) return;
      this._confirmLoginBusy = true;
      wx.showLoading({ title: '登录中...', mask: true });
      try {
        const loginAvatar = app.isTempAvatarPath(tempAvatarUrl) ? null : tempAvatarUrl || null;
        await app.login(nick, loginAvatar);
        if (tempAvatarUrl && app.isTempAvatarPath(tempAvatarUrl)) {
          try {
            await app.uploadAvatar(tempAvatarUrl);
          } catch (upErr) {
            console.error('头像上传失败:', upErr);
          }
        }
        await app.getUserInfo();
        this.closeLoginModal();
        wx.showToast({ title: '登录成功', icon: 'success' });
        if (this.data.fromLoginGate) {
          this.setData({ fromLoginGate: false });
          wx.switchTab({ url: '/pages/index/index' });
        }
      } catch (err) {
        wx.showToast({ title: '登录失败', icon: 'none' });
      } finally {
        wx.hideLoading();
        this._confirmLoginBusy = false;
      }
    }
  }
});
