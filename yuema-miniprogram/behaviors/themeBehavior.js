/**
 * 页面主题：同步 themeMeta、主题容器 class，并刷新导航栏/窗口底色/tabBar。
 */
const theme = require('../utils/theme');

module.exports = Behavior({
  data: {
    themeIsDark: false,
    themeScopeClass: 'theme-scope',
    themeSwitchColor: '#d97757',
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
      const ui = theme.getThemeUIData(mode);
      this.setData(ui);
    }
  }
});
