/**
 * 将 rooms.game_rules 解析为界面用的预设标签、自定义行（与创建页桶结构一致）
 */
const { GAME_RULE_OPTIONS } = require('./gameRuleSets');

/**
 * @param {object} room 含 gameType、gameRules
 * @returns {{ presetTags: Array<{key:string,label:string}>, customLines: string[] }}
 */
function parseGameRulesDisplay(room) {
  let parsed = {};
  if (room && room.gameRules) {
    try {
      parsed = typeof room.gameRules === 'string' ? JSON.parse(room.gameRules) : room.gameRules;
    } catch (e) {
      parsed = {};
    }
  }
  const gt = (room && room.gameType) || 'sichuan';
  const bucket = parsed[gt] || {};
  const opts = GAME_RULE_OPTIONS[gt] || [];
  const presetTags = [];
  opts.forEach((o) => {
    if (bucket[o.key] === true) {
      presetTags.push({ key: o.key, label: o.label });
    }
  });
  // 四川：加底与加番为二选一展示，不与「换三张」等布尔项混为一谈
  if (gt === 'sichuan') {
    const di = bucket.jiaDi === true;
    const fan = bucket.jiaFan === true;
    if (di && fan) {
      presetTags.push({ key: 'jiaDi', label: '加底' });
    } else if (di) {
      presetTags.push({ key: 'jiaDi', label: '加底' });
    } else if (fan) {
      presetTags.push({ key: 'jiaFan', label: '加番' });
    } else if (bucket.jiaDiJiaFan === true) {
      // 旧数据仅布尔「加底加番」：仍显示统称，避免无标签；新创建应已拆成 jiaDi/jiaFan
      presetTags.push({ key: 'jiaDiJiaFan', label: '加底加番' });
    }
  }
  const customLines = Array.isArray(bucket.customLines)
    ? bucket.customLines.map((s) => String(s)).filter((t) => t.trim() !== '')
    : [];
  return { presetTags, customLines };
}

module.exports = {
  parseGameRulesDisplay
};
