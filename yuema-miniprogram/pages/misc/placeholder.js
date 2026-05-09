/**
 * 功能占位页：由 query 传入 title/subtitle（encodeURIComponent），导航栏标题同步 title。
 * 路径放在 pages/misc（而非 pages/common），避免个别基础库/编译选项将 common 解析异常导致「wxml not found」。
 */

/** decodeURIComponent 失败时降级为原始字符串，避免空白页 */
function safeDecode(v) {
  if (v == null || v === '') {
    return '';
  }
  const s = String(v);
  try {
    return decodeURIComponent(s);
  } catch (e) {
    return s;
  }
}

Page({
  behaviors: [require('../../behaviors/themeBehavior')],
  data: {
    pageTitle: '提示',
    subtitle: ''
  },

  onLoad(options) {
    const title = safeDecode(options.title) || '提示';
    const subtitle = safeDecode(options.subtitle) || '功能即将上线，敬请期待';
    this.setData({ pageTitle: title, subtitle });
    wx.setNavigationBarTitle({ title });
  },

  onKnowTap() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({ url: '/pages/user/index' });
      }
    });
  }
});
