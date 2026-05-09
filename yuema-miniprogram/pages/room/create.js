const roomService = require('../../services/roomService');
const venueService = require('../../services/venueService');
const { GAME_RULE_OPTIONS } = require('../../utils/gameRuleSets');

/** 初始化某一玩法的空桶（布尔默认 false + customLines） */
function emptyBucket(gameType) {
  const opts = GAME_RULE_OPTIONS[gameType] || [];
  const b = { customLines: [] };
  opts.forEach((o) => {
    b[o.key] = false;
  });
  return b;
}

function buildInitialRuleBuckets() {
  return {
    sichuan: emptyBucket('sichuan'),
    guobiao: emptyBucket('guobiao'),
    guangdong: emptyBucket('guangdong')
  };
}

/** 解析服务端 game_rules 回填各玩法桶（切换玩法时保留未展示桶的数据） */
function mergeGameRulesFromRoom(room) {
  const buckets = buildInitialRuleBuckets();
  const raw = room.gameRules;
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
      if (src[o.key] === true) {
        buckets[gt][o.key] = true;
      }
    });
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
    /** 当前玩法下的预设项列表，用于 wx:for */
    currentRuleOptions: [],
    /** 按玩法分桶：布尔键 + customLines */
    ruleBuckets: buildInitialRuleBuckets(),
    /** 本条自定义规则输入草稿 */
    customLineInput: '',
    /** 当前玩法桶下的自定义条展示列表（与 ruleBuckets 同步，便于 WXML 绑定） */
    displayCustomLines: [],
    /** 当前玩法桶的浅拷贝（供 switch 绑定，避免 WXML 双层动态路径） */
    activeBucketCopy: emptyBucket('sichuan'),
    /** 全局备注，对应 rooms.remark */
    remark: '',
    maxPlayersOptions: [2, 3, 4],
    maxPlayersIndex: 2,
    venues: [],
    venueIndex: -1,
    selectedLocation: null // {address, latitude, longitude}
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
    this.setData({ editRoomId });
    await this.loadVenues();
    if (editRoomId) {
      await this.prefillEditForm(editRoomId);
    } else {
      this.syncRuleUi();
    }
  },

  /** 根据 gameTypeIndex 刷新当前玩法下的规则选项列表 */
  syncRuleUi() {
    const { gameTypes, gameTypeIndex, ruleBuckets } = this.data;
    const gid = gameTypes[gameTypeIndex].id;
    const opts = GAME_RULE_OPTIONS[gid] || [];
    const bucket = ruleBuckets[gid] || emptyBucket(gid);
    const lines = bucket.customLines || [];
    this.setData({
      currentGameTypeId: gid,
      currentRuleOptions: opts,
      displayCustomLines: lines,
      activeBucketCopy: { ...bucket }
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
      const ruleBuckets = mergeGameRulesFromRoom(room);
      this.setData(
        {
          gameTypeIndex: gtIdx,
          maxPlayersIndex: mpIdx,
          venueIndex: vIdx,
          selectedLocation,
          ruleBuckets,
          remark: room.remark || ''
        },
        () => this.syncRuleUi()
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

  /** 预设规则开关：写入当前玩法桶 */
  onRuleSwitch(e) {
    const key = e.currentTarget.dataset.key;
    const checked = e.detail.value;
    const gid = this.data.currentGameTypeId;
    // 不用整对象替换 activeBucketCopy，避免 wx:for 下 switch 整组重建导致顶部区域闪屏
    this.setData({
      [`ruleBuckets.${gid}.${key}`]: checked,
      [`activeBucketCopy.${key}`]: checked
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
      'activeBucketCopy.customLines': arr,
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
        'activeBucketCopy.customLines': arr,
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

    const data = {
      gameType: gameTypes[gameTypeIndex].id,
      maxPlayers: maxPlayersOptions[maxPlayersIndex],
      venueId: venueIndex === -1 ? null : venues[venueIndex].id,
      latitude: venueIndex === -1 && this.data.selectedLocation ? this.data.selectedLocation.latitude : null,
      longitude: venueIndex === -1 && this.data.selectedLocation ? this.data.selectedLocation.longitude : null,
      gameRules: ruleBuckets,
      remark: (remark || '').trim()
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
