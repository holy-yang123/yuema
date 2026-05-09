/**
 * 各玩法预设规则 key → 界面文案（与后端 game_rules JSON 布尔键一致）
 */
/** 四川「加底/加番」单选组在 radio-group 里用的「不选」占位 value */
const SICHUAN_JIA_SCORE_RADIO_NONE = '__none__';

const GAME_RULE_OPTIONS = {
  sichuan: [
    { key: 'huanSanZhang', label: '换三张' },
    { key: 'xueLiuChengHe', label: '血流成河' }
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
  GAME_RULE_OPTIONS,
  SICHUAN_JIA_SCORE_RADIO_NONE
};
