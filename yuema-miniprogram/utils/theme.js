/**
 * 全局浅色 / 深色主题：与 app.wxss 中 .theme-scope / .theme-scope--dark 令牌数值保持一致，
 * 供导航栏、窗口底色、tabBar、page-meta 等无法仅靠 WXSS 覆盖的能力使用。
 */
const STORAGE_KEY = 'yuema_theme_mode';

/** Tab 页 route（无开头的 /） */
const TAB_ROUTES = ['pages/index/index', 'pages/room/list', 'pages/venue/list', 'pages/user/index'];

const LIGHT = {
  navigationBarBackgroundColor: '#faf9f5',
  navigationFrontColor: '#000000',
  backgroundColor: '#faf9f5',
  backgroundColorTop: '#fdfcfa',
  backgroundColorBottom: '#f3f1ea',
  tabBarColor: '#b0aea5',
  tabBarSelectedColor: '#d97757',
  tabBarBackgroundColor: '#faf9f5',
  tabBarBorderStyle: 'white',
  pageMetaRootBg: '#faf9f5',
  pageMetaBg: '#faf9f5',
  pageMetaBgBottom: '#faf9f5',
  pageMetaTextStyle: 'dark'
};

const DARK = {
  navigationBarBackgroundColor: '#1e1e1c',
  navigationFrontColor: '#ffffff',
  backgroundColor: '#1e1e1c',
  backgroundColorTop: '#262624',
  backgroundColorBottom: '#1a1a18',
  tabBarColor: '#9c9a92',
  tabBarSelectedColor: '#e89572',
  tabBarBackgroundColor: '#222220',
  tabBarBorderStyle: 'black',
  pageMetaRootBg: '#1e1e1c',
  pageMetaBg: '#1e1e1c',
  pageMetaBgBottom: '#1a1a18',
  pageMetaTextStyle: 'light'
};

function normalizeMode(raw) {
  return raw === 'dark' ? 'dark' : 'light';
}

function getThemeMode() {
  try {
    const v = wx.getStorageSync(STORAGE_KEY);
    return normalizeMode(v);
  } catch (e) {
    return 'light';
  }
}

function saveThemeMode(mode) {
  const m = normalizeMode(mode);
  try {
    wx.setStorageSync(STORAGE_KEY, m);
  } catch (e) {
    console.warn('[theme] saveThemeMode', e);
  }
  const app = typeof getApp === 'function' ? getApp() : null;
  if (app && app.globalData) {
    app.globalData.themeMode = m;
  }
  return m;
}

function getChromeConfig(mode) {
  return normalizeMode(mode) === 'dark' ? DARK : LIGHT;
}

/** 供页面 setData：主题容器 class + page-meta */
function getThemeUIData(mode) {
  const m = normalizeMode(mode);
  const c = getChromeConfig(m);
  return {
    themeIsDark: m === 'dark',
    themeScopeClass: m === 'dark' ? 'theme-scope theme-scope--dark' : 'theme-scope',
    themeSwitchColor: m === 'dark' ? '#e89572' : '#d97757',
    themeMeta: {
      rootBg: c.pageMetaRootBg,
      bg: c.pageMetaBg,
      bgBottom: c.pageMetaBgBottom,
      textStyle: c.pageMetaTextStyle
    }
  };
}

function currentRoute() {
  const stack = getCurrentPages();
  const cur = stack[stack.length - 1];
  return cur && cur.route ? cur.route : '';
}

function isTabRoute(route) {
  return TAB_ROUTES.indexOf(route) !== -1;
}

/**
 * 同步原生壳层（导航栏、窗口底色、tabBar）；非 Tab 页跳过 tabBar 避免无效调用。
 */
function applyChrome(mode) {
  const m = normalizeMode(mode);
  const c = getChromeConfig(m);
  wx.setNavigationBarColor({
    frontColor: c.navigationFrontColor,
    backgroundColor: c.navigationBarBackgroundColor,
    animation: {
      duration: 200,
      timingFunc: 'easeOut'
    }
  });
  if (wx.setBackgroundColor) {
    wx.setBackgroundColor({
      backgroundColor: c.backgroundColor,
      backgroundColorTop: c.backgroundColorTop,
      backgroundColorBottom: c.backgroundColorBottom
    });
  }
  const route = currentRoute();
  if (route && isTabRoute(route)) {
    wx.setTabBarStyle({
      color: c.tabBarColor,
      selectedColor: c.tabBarSelectedColor,
      backgroundColor: c.tabBarBackgroundColor,
      borderStyle: c.tabBarBorderStyle
    });
  }
}

module.exports = {
  STORAGE_KEY,
  getThemeMode,
  saveThemeMode,
  getChromeConfig,
  getThemeUIData,
  applyChrome,
  isTabRoute,
  TAB_ROUTES
};
