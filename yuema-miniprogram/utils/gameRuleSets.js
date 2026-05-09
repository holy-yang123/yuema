/**
 * 各玩法预设规则 key → 界面文案（与后端 game_rules JSON 布尔键一致）
 */
const GAME_RULE_OPTIONS = {
  sichuan: [
    { key: 'huanSanZhang', label: '换三张' },
    { key: 'xueLiuChengHe', label: '血流成河' },
    { key: 'jiaDiJiaFan', label: '加底加番' }
  ],
  guobiao: [
    { key: 'baFanQiHe', label: '八番起和' },
    { key: 'yiPaoDuoXiang', label: '一炮多响' },
    { key: 'ziMoJiaBei', label: '自摸加番' }
  ],
  guangdong: [
    { key: 'jinZiMoHu', label: '仅自摸胡' },
    { key: 'fanGui', label: '翻鬼（赖子）' },
    { key: 'maiMa', label: '买马' },
    { key: 'wuGuiFanBei', label: '无鬼翻倍' }
  ]
};

module.exports = {
  GAME_RULE_OPTIONS
};
