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

const store = require('../../utils/store');
const authBehavior = require('../../behaviors/authBehavior');

Page({
  behaviors: [
    require('../../behaviors/themeBehavior'),
    authBehavior
  ],
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
    /** 信誉与实名摘要，与 /user/info 字段一致 */
    trustSummary: { reputation: 100, verified: false, realnameText: '未实名核验' },
    showWxRealnameModal: false,
    showLoginModal: false,
    /** 来自登录门禁页完善资料，成功后回首页 Tab */
    fromLoginGate: false,
    /** 登录完善资料弹窗昵称（与编辑资料一致须同步 data，避免未 blur 提交为空） */
    tempNickname: '',
    tempAvatarUrl: ''
  },

  observers: {
    'userInfo': function(userInfo) {
      if (!userInfo || !userInfo.id) return;
      this.applyUserInfoDerivedData(userInfo);
    }
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
  },

  onShow() {
    if (this.data.isLoggedIn) {
      app.getUserInfo(); // 自动更新 store，进而触发 observer
    }
  },

  /** 个人中心开关：持久化并刷新壳层与本页主题容器（见 utils/theme.js） */
  onThemeDarkChange(e) {
    const mode = e.detail.value ? 'dark' : 'light';
    themeUtil.saveThemeMode(mode);
    themeUtil.applyChrome(mode);
    this.setData(themeUtil.getThemeUIData(mode));
  },

  /** 计算用户信息相关的衍生展示数据 */
  applyUserInfoDerivedData(userInfo) {
    // 计算胜率
    const winRate = userInfo.totalGames > 0 
      ? Math.round((userInfo.winGames / userInfo.totalGames) * 100) 
      : 0;
    
    // 等级名称
    const levelNames = ['雀士', '雀杰', '雀豪', '雀圣', '雀神'];
    const lv = Number(userInfo.level);
    const safeLevel = Number.isFinite(lv) ? lv : 1;
    const levelIdx = Math.min(Math.max(safeLevel - 1, 0), 4);
    const levelName = levelNames[levelIdx] || '雀士';

    // 绑定手机菜单状态
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

  // 加载用户信息 (改为调用 App 封装的同步方法)
  async loadUserInfo() {
      };

      this.setData({
        userInfo: userInfo,
        winRate: winRate,
        levelName: levelName,
        phoneMenuStatus,
        trustSummary
      });

      // 更新全局数据
      app.globalData.userInfo = userInfo;
    } catch (err) {
      console.error('加载用户信息失败:', err);
    }
  },

  // 我的牌局：须登录后再请求 /room/my，否则 401 会整页踢回登录栈
  goToMyRooms() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/room/list?type=my'
    });
  },

  // 历史战绩
  goToHistory() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/user/history'
    });
  },

  // 我的好友：统一占位页，后续可替换为真实列表
  goToFriends() {
    wx.navigateTo({
      url: `/pages/misc/placeholder?title=${encodeURIComponent('我的好友')}&subtitle=${encodeURIComponent(
        '好友相关能力即将上线，敬请期待'
      )}`
    });
  },

  // 我的订单：同上占位页
  goToOrders() {
    wx.navigateTo({
      url: `/pages/misc/placeholder?title=${encodeURIComponent('我的订单')}&subtitle=${encodeURIComponent(
        '订单与支付相关能力即将上线，敬请期待'
      )}`
    });
  },

  // 编辑资料：弹窗内同时改昵称与头像（头像为新选的本地临时文件时再上传）
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

  /** 微信 getPhoneNumber 回调：换绑手机号并置 realname_verified */
  async onWxPhoneForRealname(e) {
    const d = (e && e.detail) || {};
    const em = d.errMsg || '';
    // 失败原因见微信文档 errMsg；统一打日志便于真机调试（开发者工具里常无 code）
    if (em && em.indexOf('fail') >= 0) {
      console.error('[getPhoneNumber]', d);
      let title = '授权失败，请重试';
      if (em.indexOf('deny') >= 0 || em.indexOf('cancel') >= 0) {
        title = '已取消或未同意授权';
      } else if (em.indexOf('data empty') >= 0) {
        // 开发者工具/模拟器常见：微信不下发手机号临时凭证，须真机预览调试
        title = '请用手机扫码真机预览（工具内常返回 data empty）';
      } else if (
        em.indexOf('jsapi has no permission') >= 0 ||
        em.indexOf('operateWXData') >= 0 ||
        Number(d.errno) === 102
      ) {
        // 真机也会出现：与「是否真机」无关，是公众平台未授予该 JSAPI（隐私指引/主体类型等）
        wx.showModal({
          title: '未开通手机号接口权限',
          content:
            '控制台若出现 errno 102 / jsapi has no permission：请到微信公众平台 → 设置 → 服务内容声明 → 用户隐私保护指引，补充说明并勾选「手机号」相关接口；并确认主体与类目符合微信要求（个人主体往往无法使用手机号快速验证，需企业认证等）。保存后重新上传体验版再试。',
          showCancel: false
        });
        return;
      } else if (em.indexOf('no permission') >= 0) {
        title = '无接口权限：请检查隐私指引与小程序认证状态';
      } else if (em.indexOf('privacy') >= 0 || em.indexOf('api scope') >= 0) {
        title = '请在后台配置用户隐私保护指引';
      }
      wx.showToast({ title, icon: 'none', duration: 2800 });
      return;
    }
    const code = d.code;
    if (!code) {
      console.error('[getPhoneNumber] 无 code', d);
      wx.showToast({ title: '未拿到授权凭证，请真机重试', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '校验中', mask: true });
    try {
      await userService.bindWxPhone({ code });
      wx.showToast({ title: '认证成功', icon: 'success' });
      this.setData({ showWxRealnameModal: false });
      await this.loadUserInfo();
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 绑定手机；已绑定则二次确认后再走换绑输入
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
          store.setState({ 
            token: null,
            userInfo: null
          });
          // 重置本地页面数据（衍生数据由 observer 自动处理或手动清空）
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

  // bindinput：用户输入后直接点「进入约麻」时仍未触发 blur，须同步昵称到 data
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

    if (this._confirmLoginBusy) {
      return;
    }
    this._confirmLoginBusy = true;
    wx.showLoading({ title: '登录中...', mask: true });
    try {
      // 临时本地路径不要写入登录接口（无法持久化）；其它非临时 URL 可随登录一次写入
      const loginAvatar = app.isTempAvatarPath(tempAvatarUrl) ? null : tempAvatarUrl || null;
      await app.login(nick, loginAvatar);

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
