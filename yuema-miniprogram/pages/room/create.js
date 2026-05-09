const roomService = require('../../services/roomService');
const venueService = require('../../services/venueService');
const { GAME_RULE_OPTIONS, SICHUAN_JIA_SCORE_RADIO_NONE } = require('../../utils/gameRuleSets');
const { splitPickerDateTime, pickScheduleFields } = require('../../utils/roomScheduleDisplay');

/** 创建页日期默认值 yyyy-MM-dd */
function todayYmd() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? `0${m}` : m}-${day < 10 ? `0${day}` : day}`;
}

/** 预计时长：仅 3–24 小时（分钟入库），符合「牌局时间三小时起」 */
function buildDurationHourOptions() {
  const opts = [];
  for (let h = 3; h <= 24; h += 1) {
    opts.push({ label: `${h}小时`, value: h * 60 });
  }
  return opts;
}

/** 本地日期 yyyy-MM-dd + 时间 HH:mm → 毫秒时间戳 */
function localDateTimeMs(dateStr, timeStr) {
  if (!dateStr || !timeStr) {
    return NaN;
  }
  const ps = dateStr.split('-').map((x) => parseInt(x, 10));
  const pt = timeStr.split(':').map((x) => parseInt(x, 10));
  if (ps.length !== 3 || pt.length < 2) {
    return NaN;
  }
  const [y, mo, d] = ps;
  const [hh, mm] = pt;
  if ([y, mo, d, hh, mm].some((n) => Number.isNaN(n))) {
    return NaN;
  }
  return new Date(y, mo - 1, d, hh, mm, 0, 0).getTime();
}

/** 将本地时间戳落到当前分钟起始，便于与日期控件选项对齐比较 */
function floorLocalMsToMinute(ms) {
  const x = new Date(ms);
  x.setSeconds(0, 0);
  return x.getTime();
}

/** 当前本地时刻，格式 HH:mm（与 time picker 同一粒度） */
function currentHmFlooredStr() {
  const x = new Date();
  x.setSeconds(0, 0);
  const h = x.getHours();
  const m = x.getMinutes();
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:${pad(m)}`;
}

/** 止须至少晚于起 3 小时（毫秒） */
const THREE_H_MS = 3 * 60 * 60 * 1000;

/** 本地毫秒 → yyyy-MM-dd、HH:mm */
function msToYmdHm(ms) {
  const d = new Date(ms);
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  return {
    ymd: `${y}-${pad(mo)}-${pad(day)}`,
    hm: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  };
}

/** 起时刻 + 3 小时的毫秒时间戳 */
function minEndMsFromBegin(beginDay, beginTime) {
  const tb = localDateTimeMs(beginDay, beginTime);
  if (Number.isNaN(tb)) {
    return NaN;
  }
  return tb + THREE_H_MS;
}

/** 初始化某一玩法的空桶（布尔默认 false + customLines） */
function emptyBucket(gameType) {
  const opts = GAME_RULE_OPTIONS[gameType] || [];
  const b = { customLines: [] };
  opts.forEach((o) => {
    b[o.key] = false;
  });
  // 四川麻将：加底/加番为单选，与 gameRulesDisplay / 后端 JSON 中 jiaDi、jiaFan 布尔一致
  if (gameType === 'sichuan') {
    b.jiaDi = false;
    b.jiaFan = false;
  }
  return b;
}

function buildInitialRuleBuckets() {
  return {
    sichuan: emptyBucket('sichuan'),
    guobiao: emptyBucket('guobiao'),
    guangdong: emptyBucket('guangdong')
  };
}

/** JSON 布尔兼容：部分链路可能把 true 落成 1 */
function ruleBoolTrue(v) {
  return v === true || v === 1;
}

/** 解析服务端 game_rules 回填各玩法桶（切换玩法时保留未展示桶的数据） */
function mergeGameRulesFromRoom(room) {
  const buckets = buildInitialRuleBuckets();
  // 兼容字段名差异；gameRules 可能已是对象（网关二次解析时）
  const raw = room.gameRules != null ? room.gameRules : room.game_rules;
  if (!raw) {
    return buckets;
  }
  let parsed = {};
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return buckets;
  }
  Object.keys(parsed).forEach((gt) => {
    if (!buckets[gt]) {
      buckets[gt] = emptyBucket(gt);
    }
    const src = parsed[gt];
    if (!src || typeof src !== 'object') {
      return;
    }
    const opts = GAME_RULE_OPTIONS[gt] || [];
    opts.forEach((o) => {
      if (ruleBoolTrue(src[o.key])) {
        buckets[gt][o.key] = true;
      }
    });
    // 四川：回填加底/加番；旧版仅 jiaDiJiaFan 为 true 时默认视为加底，便于用户改成明确项
    if (gt === 'sichuan' && src && typeof src === 'object') {
      if (ruleBoolTrue(src.jiaDi)) {
        buckets[gt].jiaDi = true;
      }
      if (ruleBoolTrue(src.jiaFan)) {
        buckets[gt].jiaFan = true;
      }
      if (ruleBoolTrue(src.jiaDiJiaFan) && !ruleBoolTrue(src.jiaDi) && !ruleBoolTrue(src.jiaFan)) {
        buckets[gt].jiaDi = true;
      }
    }
    if (Array.isArray(src.customLines)) {
      buckets[gt].customLines = src.customLines
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 5)
        .map((t) => (t.length > 40 ? t.slice(0, 40) : t));
    }
  });
  return buckets;
}

Page({
  behaviors: [require('../../behaviors/themeBehavior')],
  data: {
    /** 非空表示编辑模式（供 WXML 按钮文案） */
    editRoomId: null,
    gameTypes: [
      { id: 'sichuan', name: '四川麻将' },
      { id: 'guobiao', name: '国标麻将' },
      { id: 'guangdong', name: '广东麻将' }
    ],
    gameTypeIndex: 0,
    /** 与 picker 同步，供 WXML 绑定 ruleBuckets[currentGameTypeId] */
    currentGameTypeId: 'sichuan',
    /** 每条含 checked，避免 switch 绑定对象动态下标时多开关状态错乱 */
    ruleSwitchRows: [],
    /** 四川「加底/加番」单选：'jiaDi' | 'jiaFan' | '__none__'，与各 radio 的 checked 绑定 */
    sichuanJiaPick: SICHUAN_JIA_SCORE_RADIO_NONE,
    /** 按玩法分桶：布尔键 + customLines */
    ruleBuckets: buildInitialRuleBuckets(),
    /** 本条自定义规则输入草稿 */
    customLineInput: '',
    /** 当前玩法桶下的自定义条展示列表（与 ruleBuckets 同步，便于 WXML 绑定） */
    displayCustomLines: [],
    /** 全局备注，对应 rooms.remark */
    remark: '',
    maxPlayersOptions: [2, 3, 4],
    maxPlayersIndex: 2,
    venues: [],
    venueIndex: -1,
    selectedLocation: null, // {address, latitude, longitude}
    /** picker 缺省日期锚点（未选日期时仍可弹出合法 date 控件） */
    swDefaultDate: '',
    swBeginDate: '',
    swBeginTime: '',
    swEndDate: '',
    swEndTime: '',
    /** date 模式 picker 最小日期（首日帧即用 todayYmd，避免 start 为空） */
    scheduleMinDate: todayYmd(),
    /** 选中日为今天时，time picker 的 start（不能早于当前时刻） */
    swBeginTimePickerStart: '00:00',
    swEndTimePickerStart: '00:00',
    durationOptions: buildDurationHourOptions(),
    durationIndex: 0
  },

  async onLoad(options) {
    // 编辑模式：带房间 id，拉取详情回填表单
    let editRoomId = null;
    if (options && options.id) {
      const rid = parseInt(options.id, 10);
      if (!isNaN(rid)) {
        editRoomId = rid;
        wx.setNavigationBarTitle({ title: '编辑牌局' });
      }
    }
    const anchor = todayYmd();
    this.setData({ editRoomId, scheduleMinDate: anchor, swDefaultDate: anchor });
    await this.loadVenues();
    if (editRoomId) {
      await this.prefillEditForm(editRoomId);
      this.refreshScheduleTimeLimits();
    } else {
      // 新建：「开始时间（起）」默认当前时刻（分钟），并联动默认「止」=起+3h
      const nowHm = currentHmFlooredStr();
      this.setData(
        {
          swBeginDate: anchor,
          swBeginTime: nowHm
        },
        () => {
          this.applyDefaultEndFromBegin();
          this.syncRuleUi();
          this.refreshScheduleTimeLimits();
        }
      );
    }
  },

  onShow() {
    // 跨日或时钟走动后刷新：日期下限 + 今日时间 picker 的 start + 钳制已选时间
    this.refreshScheduleTimeLimits();
  },

  /**
   * 今日选中日期的时刻不得早于当前：刷新 time 的 start，并把已选时刻钳到当前分钟之后
   */
  refreshScheduleTimeLimits() {
    const today = todayYmd();
    const nowHm = currentHmFlooredStr();
    const nowMs = floorLocalMsToMinute(Date.now());
    const { swBeginDate, swEndDate, swBeginTime, swEndTime, swDefaultDate } = this.data;
    // 未点日期时 WXML 仍用 swDefaultDate 展示「今天」，逻辑必须与展示一致，否则 time 的 start 会误为 00:00 可选过去时刻
    const beginDay = swBeginDate || swDefaultDate || today;
    const endDay = swEndDate || swDefaultDate || today;
    const patch = {
      scheduleMinDate: today,
      swDefaultDate: today,
      swBeginTimePickerStart: beginDay === today ? nowHm : '00:00',
      swEndTimePickerStart: endDay === today ? nowHm : '00:00'
    };
    if (beginDay === today && swBeginTime) {
      const t = localDateTimeMs(beginDay, swBeginTime);
      if (!Number.isNaN(t) && t < nowMs) {
        patch.swBeginTime = nowHm;
      }
    }
    if (endDay === today && swEndTime) {
      const t = localDateTimeMs(endDay, swEndTime);
      if (!Number.isNaN(t) && t < nowMs) {
        patch.swEndTime = nowHm;
      }
    }
    // 止 ≥ max(当前, 起+3h)（默认填充后此处兜底编辑旧数据）
    const beginTimeEff = patch.swBeginTime !== undefined ? patch.swBeginTime : swBeginTime;
    if (beginTimeEff) {
      const minAfterBegin = minEndMsFromBegin(beginDay, beginTimeEff);
      if (!Number.isNaN(minAfterBegin)) {
        const minEndOk = Math.max(nowMs, minAfterBegin);
        const endDayEff = swEndDate || swDefaultDate || today;
        const endTimeEff = patch.swEndTime !== undefined ? patch.swEndTime : swEndTime;
        if (endTimeEff) {
          const te = localDateTimeMs(endDayEff, endTimeEff);
          if (!Number.isNaN(te) && te < minEndOk) {
            const { ymd, hm } = msToYmdHm(minEndOk);
            patch.swEndDate = ymd;
            patch.swEndTime = hm;
          }
        }
      }
    }
    this.setData(patch);
  },

  /** 选了「开始时间（起）」后默认把「止」设为起 + 3 小时（跨日自动换格） */
  applyDefaultEndFromBegin() {
    const { swBeginDate, swBeginTime, swDefaultDate } = this.data;
    const beginDay = swBeginDate || swDefaultDate;
    if (!beginDay || !swBeginTime) {
      return;
    }
    let msEnd = minEndMsFromBegin(beginDay, swBeginTime);
    if (Number.isNaN(msEnd)) {
      return;
    }
    msEnd = Math.max(floorLocalMsToMinute(Date.now()), msEnd);
    const { ymd, hm } = msToYmdHm(msEnd);
    this.setData({ swEndDate: ymd, swEndTime: hm });
  },

  /** 根据 gameTypeIndex 刷新当前玩法下的规则选项列表 */
  syncRuleUi() {
    const { gameTypes, gameTypeIndex, ruleBuckets } = this.data;
    const gid = gameTypes[gameTypeIndex].id;
    const opts = GAME_RULE_OPTIONS[gid] || [];
    const bucket = ruleBuckets[gid] || emptyBucket(gid);
    const lines = bucket.customLines || [];
    const ruleSwitchRows = opts.map((o) => ({
      key: o.key,
      label: o.label,
      checked: !!bucket[o.key]
    }));
    let sichuanJiaPick = SICHUAN_JIA_SCORE_RADIO_NONE;
    if (gid === 'sichuan') {
      if (ruleBoolTrue(bucket.jiaDi)) {
        sichuanJiaPick = 'jiaDi';
      } else if (ruleBoolTrue(bucket.jiaFan)) {
        sichuanJiaPick = 'jiaFan';
      }
    }
    this.setData({
      currentGameTypeId: gid,
      ruleSwitchRows,
      displayCustomLines: lines,
      sichuanJiaPick
    });
  },

  /** 编辑：根据房间详情设置 picker 与位置展示 */
  async prefillEditForm(roomId) {
    try {
      const res = await roomService.getRoomInfo(roomId);
      const room = res.data && res.data.room;
      if (!room || room.status !== 0) {
        wx.showToast({ title: room ? '仅等待中可编辑' : '房间不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }
      const { gameTypes, maxPlayersOptions, venues } = this.data;
      const gtIdx = Math.max(0, gameTypes.findIndex((g) => g.id === room.gameType));
      const mpIdx = Math.max(0, maxPlayersOptions.indexOf(room.maxPlayers));
      let vIdx = -1;
      if (room.venueId != null) {
        const found = venues.findIndex((v) => Number(v.id) === Number(room.venueId));
        vIdx = found >= 0 ? found : -1;
      }
      const lat = room.latitude != null ? Number(room.latitude) : null;
      const lng = room.longitude != null ? Number(room.longitude) : null;
      let selectedLocation = null;
      if (vIdx === -1 && lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
        selectedLocation = {
          address: '已选位置',
          latitude: lat,
          longitude: lng
        };
      }
      const sch = pickScheduleFields(room);
      const b = splitPickerDateTime(sch.begin);
      const ept = splitPickerDateTime(sch.end);
      const { durationOptions } = this.data;
      let durationIndex = 0;
      if (sch.minutes != null) {
        const m = Number(sch.minutes);
        const exact = durationOptions.findIndex((o) => o.value === m);
        if (exact >= 0) {
          durationIndex = exact;
        } else {
          // 历史数据：映射到 3–24 小时档（低于 3 小时视为 3 小时）
          const hrs = Math.max(3, Math.min(24, Math.round(m / 60)));
          const mapped = durationOptions.findIndex((o) => o.value === hrs * 60);
          durationIndex = mapped >= 0 ? mapped : 0;
        }
      }
      const ruleBuckets = mergeGameRulesFromRoom(room);
      this.setData(
        {
          swDefaultDate: todayYmd(),
          swBeginDate: b.date || '',
          swBeginTime: b.time || '',
          swEndDate: ept.date || '',
          swEndTime: ept.time || '',
          durationIndex,
          gameTypeIndex: gtIdx,
          maxPlayersIndex: mpIdx,
          venueIndex: vIdx,
          selectedLocation,
          ruleBuckets,
          remark: room.remark || ''
        },
        () => {
          this.syncRuleUi();
          this.refreshScheduleTimeLimits();
        }
      );
    } catch (err) {
      console.error('prefill edit', err);
      wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
    }
  },

  async loadVenues() {
    try {
      const res = await venueService.getVenueList();
      this.setData({
        venues: res.data || []
      });
    } catch (err) {
      console.error('加载场地失败:', err);
    }
  },

  onGameTypeChange(e) {
    const idx = parseInt(e.detail.value, 10);
    this.setData({ gameTypeIndex: idx });
    this.syncRuleUi();
  },

  onMaxPlayersChange(e) {
    this.setData({ maxPlayersIndex: e.detail.value });
  },

  onVenueChange(e) {
    this.setData({ venueIndex: e.detail.value });
  },

  onSwBeginDateChange(e) {
    const v = e.detail.value || '';
    this.setData({ swBeginDate: v }, () => {
      if (this.data.swBeginTime) {
        this.applyDefaultEndFromBegin();
      }
      this.refreshScheduleTimeLimits();
    });
  },
  onSwBeginTimeChange(e) {
    const v = e.detail.value || '';
    const today = todayYmd();
    const nowMs = floorLocalMsToMinute(Date.now());
    const beginDay = this.data.swBeginDate || this.data.swDefaultDate || today;
    if (beginDay === today && v) {
      const t = localDateTimeMs(beginDay, v);
      if (!Number.isNaN(t) && t < nowMs) {
        wx.showToast({ title: '不能早于当前时间', icon: 'none' });
        const nowHm = currentHmFlooredStr();
        this.setData({ swBeginTime: nowHm }, () => {
          this.applyDefaultEndFromBegin();
          this.refreshScheduleTimeLimits();
        });
        return;
      }
    }
    this.setData({ swBeginTime: v }, () => {
      if (v) {
        this.applyDefaultEndFromBegin();
      }
      this.refreshScheduleTimeLimits();
    });
  },
  onSwEndDateChange(e) {
    const v = e.detail.value || '';
    this.setData({ swEndDate: v }, () => {
      this.enforceEndWindowRules(() => this.refreshScheduleTimeLimits());
    });
  },
  onSwEndTimeChange(e) {
    const v = e.detail.value || '';
    const today = todayYmd();
    const nowMs = floorLocalMsToMinute(Date.now());
    const endDay = this.data.swEndDate || this.data.swDefaultDate || today;
    if (endDay === today && v) {
      const t = localDateTimeMs(endDay, v);
      if (!Number.isNaN(t) && t < nowMs) {
        wx.showToast({ title: '不能早于当前时间', icon: 'none' });
        this.setData({ swEndTime: currentHmFlooredStr() }, () => {
          this.enforceEndWindowRules(() => this.refreshScheduleTimeLimits());
        });
        return;
      }
    }
    this.setData({ swEndTime: v }, () => {
      this.enforceEndWindowRules(() => this.refreshScheduleTimeLimits());
    });
  },

  /** 手动改「止」：须 ≥ 当前且 ≥ 起+3h，否则钳到 max(当前,起+3h) */
  enforceEndWindowRules(done) {
    const cb = typeof done === 'function' ? done : () => {};
    const { swBeginDate, swBeginTime, swEndDate, swEndTime, swDefaultDate } = this.data;
    const beginDay = swBeginDate || swDefaultDate;
    const endDay = swEndDate || swDefaultDate;
    if (!swEndTime || !endDay) {
      cb();
      return;
    }
    const nowMs = floorLocalMsToMinute(Date.now());
    const te = localDateTimeMs(endDay, swEndTime);
    if (Number.isNaN(te)) {
      cb();
      return;
    }
    let targetMs = nowMs;
    if (swBeginTime && beginDay) {
      const minAfterBegin = minEndMsFromBegin(beginDay, swBeginTime);
      if (!Number.isNaN(minAfterBegin)) {
        targetMs = Math.max(nowMs, minAfterBegin);
      }
    }
    if (te < targetMs) {
      wx.showToast({ title: '须不早于当前时间，且至少晚于开始时间（起）三小时', icon: 'none' });
      const { ymd, hm } = msToYmdHm(targetMs);
      this.setData({ swEndDate: ymd, swEndTime: hm }, cb);
      return;
    }
    cb();
  },

  onDurationChange(e) {
    const i = parseInt(e.detail.value, 10);
    this.setData({ durationIndex: !isNaN(i) ? i : 0 });
  },

  /** 预设规则开关：写入当前玩法桶 */
  onRuleSwitch(e) {
    const key = e.currentTarget.dataset.key;
    const checked = e.detail.value;
    const gid = this.data.currentGameTypeId;
    const ruleSwitchRows = (this.data.ruleSwitchRows || []).map((row) =>
      row.key === key ? { ...row, checked } : row
    );
    this.setData({
      [`ruleBuckets.${gid}.${key}`]: checked,
      ruleSwitchRows
    });
  },

  /** 四川麻将：加底与加番互斥，与列表/详情卡片展示逻辑一致 */
  onSichuanJiaScoreChange(e) {
    const v = e.detail.value;
    const isDi = v === 'jiaDi';
    const isFan = v === 'jiaFan';
    this.setData({
      sichuanJiaPick: v,
      'ruleBuckets.sichuan.jiaDi': isDi,
      'ruleBuckets.sichuan.jiaFan': isFan
    });
  },

  onCustomLineInput(e) {
    this.setData({ customLineInput: e.detail.value });
  },

  /** 追加自定义规则（每桶≤5条、每条≤40字） */
  addCustomLine() {
    const gid = this.data.currentGameTypeId;
    const t = (this.data.customLineInput || '').trim();
    if (!t) {
      return;
    }
    if (t.length > 40) {
      wx.showToast({ title: '单条不超过40字', icon: 'none' });
      return;
    }
    const arr = (this.data.ruleBuckets[gid].customLines || []).slice();
    if (arr.length >= 5) {
      wx.showToast({ title: '最多5条', icon: 'none' });
      return;
    }
    arr.push(t);
    this.setData({
      [`ruleBuckets.${gid}.customLines`]: arr,
      customLineInput: '',
      displayCustomLines: arr
    });
  },

  removeCustomLine(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    const gid = this.data.currentGameTypeId;
    const arr = (this.data.ruleBuckets[gid].customLines || []).slice();
    if (idx >= 0 && idx < arr.length) {
      arr.splice(idx, 1);
      this.setData({
        [`ruleBuckets.${gid}.customLines`]: arr,
        displayCustomLines: arr
      });
    }
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  // 选择位置
  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          selectedLocation: {
            address: res.name || res.address,
            latitude: res.latitude,
            longitude: res.longitude
          }
        });
      }
    });
  },

  async submit() {
    const {
      gameTypes,
      gameTypeIndex,
      maxPlayersOptions,
      maxPlayersIndex,
      venues,
      venueIndex,
      ruleBuckets,
      remark
    } = this.data;

    const {
      swBeginDate,
      swBeginTime,
      swEndDate,
      swEndTime,
      swDefaultDate,
      durationOptions: durOpts,
      durationIndex: durIdx
    } = this.data;
    const beginDaySubmit = swBeginDate || swDefaultDate;
    const endDaySubmit = swEndDate || swDefaultDate;
    // ISO 本地日期时间，便于 Jackson 反序列化为 LocalDateTime（未点日期时与界面默认日一致）
    const startWindowBegin =
      beginDaySubmit && swBeginTime ? `${beginDaySubmit}T${swBeginTime}:00` : null;
    const startWindowEnd = endDaySubmit && swEndTime ? `${endDaySubmit}T${swEndTime}:00` : null;
    const dopt = durOpts[durIdx];
    const durationMinutes = dopt && dopt.value != null ? dopt.value : null;

    const nowMinuteMs = floorLocalMsToMinute(Date.now());
    if (beginDaySubmit && swBeginTime) {
      const tb = localDateTimeMs(beginDaySubmit, swBeginTime);
      if (Number.isNaN(tb)) {
        wx.showToast({ title: '请完整选择开始时间（起）', icon: 'none' });
        return;
      }
      if (tb < nowMinuteMs) {
        wx.showToast({ title: '开始时间（起）不能早于当前时间', icon: 'none' });
        return;
      }
    }
    if (endDaySubmit && swEndTime) {
      const te = localDateTimeMs(endDaySubmit, swEndTime);
      if (Number.isNaN(te)) {
        wx.showToast({ title: '请完整选择开始时间（止）', icon: 'none' });
        return;
      }
      if (te < nowMinuteMs) {
        wx.showToast({ title: '开始时间（止）不能早于当前时间', icon: 'none' });
        return;
      }
    }
    if (beginDaySubmit && swBeginTime && endDaySubmit && swEndTime) {
      const tb = localDateTimeMs(beginDaySubmit, swBeginTime);
      const te = localDateTimeMs(endDaySubmit, swEndTime);
      if (!Number.isNaN(tb) && !Number.isNaN(te) && te < tb + THREE_H_MS) {
        wx.showToast({ title: '开始时间（止）须至少晚于开始时间（起）三小时', icon: 'none' });
        return;
      }
    }
    if (!durationMinutes || durationMinutes < 180) {
      wx.showToast({ title: '预计牌局时长至少为3小时', icon: 'none' });
      return;
    }

    const data = {
      gameType: gameTypes[gameTypeIndex].id,
      maxPlayers: maxPlayersOptions[maxPlayersIndex],
      venueId: venueIndex === -1 ? null : venues[venueIndex].id,
      latitude: venueIndex === -1 && this.data.selectedLocation ? this.data.selectedLocation.latitude : null,
      longitude: venueIndex === -1 && this.data.selectedLocation ? this.data.selectedLocation.longitude : null,
      gameRules: ruleBuckets,
      remark: (remark || '').trim(),
      startWindowBegin,
      startWindowEnd,
      durationMinutes
    };

    try {
      const isEdit = !!this.data.editRoomId;
      wx.showLoading({ title: isEdit ? '保存中...' : '创建中...' });
      let createdId = null;
      if (isEdit) {
        await roomService.updateRoom(this.data.editRoomId, data);
      } else {
        const res = await roomService.createRoom(data);
        createdId = res.data && res.data.id;
      }
      wx.hideLoading();

      wx.showToast({
        title: isEdit ? '已保存' : '创建成功',
        icon: 'success'
      });

      setTimeout(() => {
        const rid = isEdit ? this.data.editRoomId : createdId;
        if (rid) {
          wx.redirectTo({
            url: `/pages/room/detail?id=${rid}`
          });
        }
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: err.message || '操作失败',
        icon: 'none'
      });
    }
  }
});
