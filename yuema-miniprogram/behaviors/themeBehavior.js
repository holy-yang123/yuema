/**
 * 页面主题：同步 themeMeta、主题容器 class，并刷新导航栏/窗口底色/tabBar。
 */
const theme = require('../utils/theme');

module.exports = Behavior({
  lifetimes: {
    attached() {
      // 与登录页一致：仅主题切换后再 setData，减轻 Tab 来回时的无效渲染
      this._appliedThemeMode = null;
    }
  },

  // onLoad 早于首帧绘制调用 applyChrome，减轻 Tab 首页仍短暂沿用 app.json 浅色导航栏的问题
  onLoad() {
    this.syncThemeFromApp();
  },

  data: {
    themeIsDark: false,
    themeScopeClass: 'theme-scope',
    themeSwitchColor: '#d97757',
    themeInputPlaceholderStyle: 'color: rgba(20,20,19,0.35); font-weight: 400',
    themeSearchIconColor: 'rgba(20,20,19,0.35)',
    themeMeta: {
      rootBg: '#faf9f5',
      bg: '#faf9f5',
      bgBottom: '#faf9f5',
      textStyle: 'dark'
    }
  },

  pageLifetimes: {
    show() {
      this.syncThemeFromApp();
    }
  },

  methods: {
    syncThemeFromApp() {
      const mode = theme.getThemeMode();
      theme.applyChrome(mode);
      if (mode === this._appliedThemeMode) {
        return;
      }
      this._appliedThemeMode = mode;
      const ui = theme.getThemeUIData(mode);
      this.setData(ui);
    }
  }
});
