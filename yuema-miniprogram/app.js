/**
 * 接口基址：最终请求形如 `${apiBaseUrl}/user/login`、`${apiBaseUrl}/user/avatar`
 *（即 /api 前缀在 apiBaseUrl 里，不要再写成 /user/api/...）
 *
 * 真机注意：微信要求 request / uploadFile / downloadFile 使用「已配置的合法域名」，
 * 通常须 HTTPS + 域名，一般不能填局域网 IP；开发者工具里勾选「不校验域名」仅对工具生效，
 * 真机扫码预览仍会校验 → 会出现请求失败、Network 里 Provisional headers、库里 avatar_url 仍为 NULL。
 * 真机联调可用：HTTPS 隧道/ngrok、部署到有证书域名，或使用开发者工具「真机调试」走调试通道。
 */
const roomService = require('./services/roomService');
const { LOGIN_PAGE } = require('./utils/pageRoutes');
const { clearAuthAndGoLogin, shouldForceRelogin } = require('./utils/authRedirect');

App({
  globalData: {
    userInfo: null,
    token: null,
    location: null, // {longitude, latitude}
    address: '', // 地址描述
    /** 小程序码 scene / 扫码待加入的房间号 */
    pendingJoinRoomNo: null,
    // 本机调试改为当前电脑的局域网 IP；真机请改为可 HTTPS 访问的后端域名并在公众平台配置服务器域名
    apiBaseUrl: 'http://192.168.1.140:8080/api'
  },

  onLaunch(options) {
    // 品牌字体：需在微信公众平台 → 开发 → 开发管理 → 服务器域名 → downloadFile 合法域名 加入 fonts.gstatic.com，否则静默失败，回退为 app.wxss 中系统栈
    const onFontFail = (name, err) => {
      console.warn(`[loadFontFace] ${name}`, err);
    };
    if (wx.loadFontFace) {
      wx.loadFontFace({
        family: 'Poppins',
        source: 'url("https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLEj6Z1xlFQ.woff2")',
        global: true,
        success: () => console.log('[loadFontFace] Poppins ok'),
        fail: (e) => onFontFail('Poppins', e)
      });
      wx.loadFontFace({
        family: 'Lora',
        source: 'url("https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787weuxJBkq0.woff2")',
        global: true,
        success: () => console.log('[loadFontFace] Lora ok'),
        fail: (e) => onFontFail('Lora', e)
      });
    }

    const q = (options && options.query) || {};
    const scene = q.scene != null ? String(q.scene) : '';
    const directNo = q.roomNo != null ? String(q.roomNo) : '';
    let roomNo = directNo;
    if (!roomNo && scene) {
      try {
        roomNo = decodeURIComponent(scene);
      } catch (e) {
        roomNo = scene;
      }
    }
    if (roomNo) {
      this.globalData.pendingJoinRoomNo = roomNo.trim();
    }

    // 检查登录状态
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.getUserInfo().finally(() => {
        this.tryConsumePendingJoin();
      });
    } else {
      this.tryConsumePendingJoin();
    }

    // 获取位置信息
    this.updateLocation();
  },

  /** 登录成功后或启动时已有 token：消费待加入房间 */
  tryConsumePendingJoin() {
    const no = this.globalData.pendingJoinRoomNo;
    if (!no || !this.globalData.token) {
      return Promise.resolve();
    }
    this.globalData.pendingJoinRoomNo = null;
    return roomService
      .joinRoom(no)
      .then((res) => {
        const roomId = res.data && res.data.roomId;
        if (roomId) {
          wx.navigateTo({
            url: `/pages/room/detail?id=${roomId}`
          });
        }
      })
      .catch((err) => {
        console.error('pending join', err);
        wx.showToast({
          title: (err && err.message) || '加入牌局失败',
          icon: 'none'
        });
      });
  },

  // 更新位置信息
  updateLocation() {
    return new Promise((resolve, reject) => {
      // 优先尝试获取精确位置
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          this.globalData.location = {
            longitude: res.longitude,
            latitude: res.latitude
          };
          resolve(this.globalData.location);
        },
        fail: (err) => {
          // 如果获取失败且没有历史位置，尝试让用户手动选
          console.error('获取位置失败:', err);
          resolve(null);
        }
      });
    });
  },

  /**
   * 头像是否为本地临时路径（需 wx.uploadFile 到服务端后才能持久化）
   * 模拟器/不同基础库下可能是 wxfile://、http(s)://tmp/、或短路径，故放宽判断。
   */
  isTempAvatarPath(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }
    const s = url.trim();
    if (/^wxfile:\/\//i.test(s)) {
      return true;
    }
    if (/^https?:\/\/tmp\//i.test(s)) {
      return true;
    }
    // 开发工具里可能出现 http://127.0.0.1:port/tmp/... 等形式
    if (/^https?:\/\/[^/]+\/tmp\//i.test(s)) {
      return true;
    }
    return false;
  },

  /**
   * 上传本地头像到服务端，返回 data.avatarUrl
   */
  uploadAvatar(filePath) {
    return new Promise((resolve, reject) => {
      if (!this.globalData.token) {
        reject('未登录');
        return;
      }
      wx.uploadFile({
        url: `${this.globalData.apiBaseUrl}/user/avatar`,
        filePath: filePath,
        name: 'file',
        header: {
          Authorization: `Bearer ${this.globalData.token}`
        },
        success: (res) => {
          const status = res.statusCode;
          let body = res.data;
          if (typeof body === 'string') {
            try {
              body = JSON.parse(body);
            } catch (e) {
              body = null;
            }
          }
          // 401 须先于「非 200」分支处理，否则只会 reject 而不会清态跳转
          if (status === 401 || shouldForceRelogin(body)) {
            clearAuthAndGoLogin({
              toastTitle: (body && body.message) || '登录已过期'
            });
            reject((body && body.message) || '登录已失效');
            return;
          }
          if (status !== undefined && status !== 200) {
            reject(`头像上传失败 HTTP ${status}`);
            return;
          }
          if (body == null || typeof body !== 'object') {
            reject('头像上传响应解析失败');
            return;
          }
          if (body.code === 200 && body.data && body.data.avatarUrl) {
            if (this.globalData.userInfo) {
              this.globalData.userInfo.avatarUrl = body.data.avatarUrl;
            }
            resolve(body.data);
          } else {
            reject((body && body.message) || '头像上传失败');
          }
        },
        fail: (e) => {
          reject((e && e.errMsg) || '头像上传网络失败');
        }
      });
    });
  },

  // 登录：服务端用 code 换 openid，身份稳定
  login(nickname = null, avatarUrl = null) {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (!res.code) {
            reject('微信登录失败');
            return;
          }
          wx.request({
            url: `${this.globalData.apiBaseUrl}/user/login`,
            method: 'POST',
            header: {
              'Content-Type': 'application/json'
            },
            data: {
              code: res.code,
              nickname: nickname,
              avatarUrl: avatarUrl
            },
            success: (result) => {
              if (result.data.code === 200) {
                const data = result.data.data;
                this.globalData.token = data.token;
                this.globalData.userInfo = data;
                wx.setStorageSync('token', data.token);
                this.tryConsumePendingJoin();
                resolve(data);
              } else if (result.data.code === 404) {
                resolve({ needProfile: true });
              } else {
                reject(result.data.message || '登录失败');
              }
            },
            fail: reject
          });
        },
        fail: reject
      });
    });
  },

  // 获取用户信息
  getUserInfo() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.globalData.apiBaseUrl}/user/info`,
        header: {
          Authorization: `Bearer ${this.globalData.token}`
        },
        success: (res) => {
          if (res.data.code === 200) {
            this.globalData.userInfo = res.data.data;
            resolve(res.data.data);
          } else if (shouldForceRelogin(res.data)) {
            // 启动拉用户信息失败：与封装 request 一致，清态回登录（避免出现未捕获的 MiniProgramError）
            clearAuthAndGoLogin({
              toastTitle: res.data.message || '请重新登录'
            });
            reject(res.data);
          } else {
            reject(res.data.message);
          }
        },
        fail: reject
      });
    });
  },

  // 检查登录
  checkLogin() {
    if (!this.globalData.token) {
      wx.reLaunch({
        url: LOGIN_PAGE
      });
      return false;
    }
    return true;
  }
});
