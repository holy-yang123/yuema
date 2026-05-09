const app = getApp();
const roomService = require('../../services/roomService');
const scoreService = require('../../services/scoreService');
const { GAME_RULE_OPTIONS } = require('../../utils/gameRuleSets');

/** 按房间当前 gameType 解析 game_rules，得到预设标签与自定义条 */
function parseRuleDisplay(room) {
  let parsed = {};
  if (room.gameRules) {
    try {
      parsed = typeof room.gameRules === 'string' ? JSON.parse(room.gameRules) : room.gameRules;
    } catch (e) {
      parsed = {};
    }
  }
  const gt = room.gameType || 'sichuan';
  const bucket = parsed[gt] || {};
  const opts = GAME_RULE_OPTIONS[gt] || [];
  const presetTags = [];
  opts.forEach((o) => {
    if (bucket[o.key] === true) {
      presetTags.push({ key: o.key, label: o.label });
    }
  });
  const customLines = Array.isArray(bucket.customLines)
    ? bucket.customLines.map((s) => String(s)).filter((t) => t.trim() !== '')
    : [];
  return { presetTags, customLines };
}
const chatService = require('../../services/chatService');
const { createRoomSocket } = require('../../utils/socket');

Page({
  behaviors: [require('../../behaviors/themeBehavior')],
  data: {
    roomId: null,
    room: {},
    members: [],
    emptySeats: [],
    isOwner: false,
    currentUserId: null,
    currentRound: 0,
    scoreSummary: { memberScores: [] },
    settlement: { settlements: [] },
    gameTypeMap: {
      sichuan: '四川麻将',
      guobiao: '国标麻将',
      guangdong: '广东麻将'
    },
    chatOpen: false,
    chatMessages: [],
    chatInput: '',
    chatScrollIntoView: '',
    showInvite: false,
    qrUrl: '',
    memberActionMember: null,
    showModifySheet: false,
    modifyPending: null,
    modifyVotes: [],
    modifyRequiredVotes: 0,
    modifyPlayerScores: [],
    modifyRequestId: null,
    modifyIsRequester: false,
    modifyCanVote: false,
    modifyHasVoted: false,
    inviteRoomNo: '',
    /** 当前玩法下勾选的预设规则展示 */
    rulePresetTags: [],
    /** 当前玩法桶下自定义规则文案 */
    ruleCustomLines: []
  },

  _socket: null,
  _wsHandlers: null,
  _sceneRoomNo: null,

  onLoad(options) {
    if (options.id) {
      this.setData({ roomId: parseInt(options.id, 10) });
    } else if (options.scene) {
      let sn = String(options.scene);
      try {
        sn = decodeURIComponent(sn);
      } catch (e) {
        // ignore
      }
      this._sceneRoomNo = sn.trim();
    }
  },

  async onShow() {
    await this.resolveSceneEntry();
    if (this.data.roomId) {
      await this.loadRoomDetail();
      this.refreshModifyPending();
      if (this.data.room.status !== 2 && app.globalData.token) {
        this.ensureSocket();
      }
    }
  },

  /** 小程序码仅带 scene（房间号）时先进本页再 join */
  async resolveSceneEntry() {
    if (!this._sceneRoomNo || this.data.roomId) {
      return;
    }
    if (!app.globalData.token) {
      app.globalData.pendingJoinRoomNo = this._sceneRoomNo;
      this._sceneRoomNo = null;
      return;
    }
    const no = this._sceneRoomNo;
    this._sceneRoomNo = null;
    try {
      const res = await roomService.joinRoom(no);
      const roomId = res.data && res.data.roomId;
      if (roomId) {
        wx.redirectTo({ url: `/pages/room/detail?id=${roomId}` });
      }
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '加入失败', icon: 'none' });
      wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
    }
  },

  onUnload() {
    this.teardownSocket();
  },

  teardownSocket() {
    if (this._socket) {
      if (this._wsHandlers) {
        Object.keys(this._wsHandlers).forEach((k) => {
          this._socket.off(k, this._wsHandlers[k]);
        });
        this._wsHandlers = null;
      }
      this._socket.close();
      this._socket = null;
    }
  },

  ensureSocket() {
    if (!this.data.roomId || !app.globalData.token) {
      return;
    }
    if (this._socket) {
      return;
    }
    const socket = createRoomSocket();
    const h = {};

    h.chat = (msg) => {
      const d = msg.data || msg.chatMessage;
      if (d && d.content != null) {
        this.appendChatLine(d);
      }
    };
    h.user_join = (msg) => {
      const line = {
        id: msg.timestamp,
        msgType: 'system',
        nickname: '系统',
        content: msg.message || (msg.nickname ? `${msg.nickname} 进入房间` : '有玩家进入'),
        createdAt: ''
      };
      this.appendChatLine(line);
      this.loadRoomDetail();
    };
    h.success = (msg) => {
      if (msg.chatMessage) {
        this.appendChatLine(msg.chatMessage);
      }
    };
    h.error = (msg) => {
      if (msg.content) {
        wx.showToast({ title: String(msg.content).slice(0, 20), icon: 'none' });
      }
    };
    h.kicked = (msg) => {
      const rid = msg.data && msg.data.roomId;
      if (rid && rid === this.data.roomId) {
        this.teardownSocket();
        wx.showModal({
          title: '提示',
          content: '你已被移出牌局',
          showCancel: false,
          success: () => {
            wx.switchTab({ url: '/pages/index/index' });
          }
        });
      }
    };
    h.member_left = () => this.loadRoomDetail();
    h.member_kicked = () => this.loadRoomDetail();
    h.room_transfer = () => this.loadRoomDetail();
    h.room_ended = () => this.loadRoomDetail();
    h.score_modify_request = () => this.refreshModifyPending();
    h.score_modify_vote_update = () => this.refreshModifyPending();
    h.score_modify_finalized = () => {
      this.refreshModifyPending();
      this.loadRoomDetail();
    };
    h.score_update = (msg) => {
      const d = msg.data;
      if (!d || Number(d.roomId) !== Number(this.data.roomId)) {
        return;
      }
      const memberScores = d.memberScores || [];
      const totalRounds = d.totalRounds != null ? d.totalRounds : this.data.currentRound;
      this.setData({
        scoreSummary: {
          roomId: d.roomId,
          totalRounds,
          memberScores
        },
        currentRound: totalRounds
      });
    };

    Object.keys(h).forEach((k) => socket.on(k, h[k]));
    this._wsHandlers = h;
    this._socket = socket;
    socket.connect(this.data.roomId);
  },

  appendChatLine(row) {
    const list = this.data.chatMessages.concat([row]);
    this.setData({ chatMessages: list, chatScrollIntoView: `msg-${row.id}` });
  },

  toggleChat() {
    const next = !this.data.chatOpen;
    this.setData({ chatOpen: next });
    if (next && this.data.chatMessages.length === 0) {
      this.loadChatHistory();
    }
  },

  async loadChatHistory() {
    if (!this.data.roomId) {
      return;
    }
    try {
      const res = await chatService.list(this.data.roomId, null, 50);
      const rows = res.data || [];
      this.setData({
        chatMessages: rows,
        chatScrollIntoView: rows.length ? `msg-${rows[rows.length - 1].id}` : ''
      });
    } catch (err) {
      console.error('chat list', err);
    }
  },

  onChatInput(e) {
    this.setData({ chatInput: e.detail.value });
  },

  sendChat() {
    const text = (this.data.chatInput || '').trim();
    if (!text || !this._socket) {
      return;
    }
    this._socket.send({ type: 'chat', content: text });
    this.setData({ chatInput: '' });
  },

  async loadRoomDetail() {
    try {
      const res = await roomService.getRoomInfo(this.data.roomId);
      const data = res.data;

      const u = app.globalData.userInfo;
      const currentUserId = u ? (u.userId != null ? u.userId : u.id) : null;
      const isOwner = data.members.some((m) => m.userId === currentUserId && m.role === 1);

      const emptySeats = [];
      const occupiedSeats = data.members.length;
      for (let i = 0; i < data.room.maxPlayers - occupiedSeats; i++) {
        emptySeats.push(i);
      }

      const ruleDisp = parseRuleDisplay(data.room);

      this.setData({
        room: data.room,
        members: data.members,
        emptySeats,
        isOwner,
        currentUserId,
        rulePresetTags: ruleDisp.presetTags,
        ruleCustomLines: ruleDisp.customLines
      });

      if (data.room.status === 1 || data.room.status === 2) {
        this.loadScoreData();
      }

      if (data.room.status === 2) {
        this.teardownSocket();
      }
    } catch (err) {
      console.error('加载房间详情失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  async loadScoreData() {
    try {
      const summaryRes = await scoreService.getScoreSummary(this.data.roomId);
      this.setData({
        scoreSummary: summaryRes.data,
        currentRound: summaryRes.data.totalRounds
      });

      if (this.data.room.status === 2) {
        const settlementRes = await scoreService.getSettlement(this.data.roomId);
        this.setData({
          settlement: settlementRes.data
        });
      }
    } catch (err) {
      console.error('加载分数数据失败:', err);
    }
  },

  async refreshModifyPending() {
    if (!this.data.roomId || this.data.room.status !== 1) {
      this.setData({ showModifySheet: false, modifyPending: null });
      return;
    }
    try {
      const res = await scoreService.modifyPending(this.data.roomId);
      const payload = res.data || {};
      const req = payload.request;
      if (!req || !req.id) {
        this.setData({
          showModifySheet: false,
          modifyPending: null,
          modifyRequestId: null,
          modifyPlayerScores: [],
          modifyIsRequester: false,
          modifyCanVote: false,
          modifyHasVoted: false
        });
        return;
      }
      const uid = this.data.currentUserId;
      const requesterId = req.requesterId;
      const votes = payload.votes || [];
      const members = this.data.members || [];
      const playerScores = (payload.playerScores || []).map((p) => {
        const mm = members.find((x) => x.userId === p.userId);
        return {
          userId: p.userId,
          scoreChange: p.scoreChange,
          displayName: mm ? mm.nickname : '玩家'
        };
      });
      const modifyIsRequester = uid != null && requesterId === uid;
      const modifyCanVote = uid != null && requesterId !== uid;
      const modifyHasVoted = modifyCanVote && votes.some((v) => v.voterId === uid);
      this.setData({
        showModifySheet: true,
        modifyPending: req,
        modifyVotes: votes,
        modifyRequiredVotes: payload.requiredVotes || 0,
        modifyPlayerScores: playerScores,
        modifyRequestId: req.id,
        modifyIsRequester,
        modifyCanVote,
        modifyHasVoted
      });
    } catch (err) {
      console.error('modify pending', err);
    }
  },

  async voteModify(e) {
    const vote = parseInt(e.currentTarget.dataset.vote, 10);
    const id = this.data.modifyRequestId;
    if (!id) {
      return;
    }
    try {
      await scoreService.modifyVote(id, vote);
      wx.showToast({ title: vote === 1 ? '已同意' : '已拒绝', icon: 'none' });
      this.refreshModifyPending();
      this.loadRoomDetail();
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
    }
  },

  async cancelModify() {
    const id = this.data.modifyRequestId;
    if (!id) {
      return;
    }
    try {
      await scoreService.modifyCancel(id);
      wx.showToast({ title: '已撤销', icon: 'none' });
      this.refreshModifyPending();
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '撤销失败', icon: 'none' });
    }
  },

  async openInvite() {
    try {
      const res = await roomService.getRoomQrCode(this.data.roomId);
      const u = (res.data && res.data.qrUrl) || '';
      this.setData({
        showInvite: true,
        qrUrl: u,
        inviteRoomNo: (res.data && res.data.roomNo) || this.data.room.roomNo
      });
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '获取二维码失败', icon: 'none' });
    }
  },

  closeInvite() {
    this.setData({ showInvite: false });
  },

  onMemberLongPress(e) {
    const ds = e.currentTarget.dataset;
    const m = {
      userId: ds.userId,
      nickname: ds.nickname,
      role: ds.role
    };
    if (m.userId == null) {
      return;
    }
    const uid = this.data.currentUserId;
    const isSelf = m.userId === uid;
    const itemList = [];
    const actions = [];
    if (isSelf) {
      if (!this.data.isOwner) {
        itemList.push('离开牌局');
        actions.push('leave');
      } else {
        wx.showToast({ title: '房主请转让或结束牌局', icon: 'none' });
        return;
      }
    } else if (this.data.isOwner) {
      itemList.push('转让房主给 TA', '踢出牌局');
      actions.push('transfer', 'kick');
    } else {
      return;
    }
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const act = actions[res.tapIndex];
        if (act === 'leave') {
          this.confirmLeave();
        } else if (act === 'kick') {
          this.confirmKick(m.userId);
        } else if (act === 'transfer') {
          this.confirmTransfer(m.userId);
        }
      }
    });
  },

  confirmLeave() {
    wx.showModal({
      title: '离开牌局',
      content: '确定离开当前牌局吗？',
      success: async (r) => {
        if (!r.confirm) {
          return;
        }
        try {
          await roomService.leaveRoom(this.data.roomId);
          wx.showToast({ title: '已离开', icon: 'none' });
          this.teardownSocket();
          wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '离开失败', icon: 'none' });
        }
      }
    });
  },

  confirmKick(targetUserId) {
    wx.showModal({
      title: '踢出玩家',
      content: '确定将该玩家移出牌局吗？',
      success: async (r) => {
        if (!r.confirm) {
          return;
        }
        try {
          await roomService.kickMember(this.data.roomId, targetUserId);
          wx.showToast({ title: '已踢出', icon: 'none' });
          this.loadRoomDetail();
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
        }
      }
    });
  },

  confirmTransfer(newOwnerId) {
    wx.showModal({
      title: '转让房主',
      content: '确认将该玩家设为新房主？',
      success: async (r) => {
        if (!r.confirm) {
          return;
        }
        try {
          await roomService.transferRoom(this.data.roomId, newOwnerId);
          wx.showToast({ title: '已转让', icon: 'none' });
          this.loadRoomDetail();
        } catch (err) {
          wx.showToast({ title: (err && err.message) || '转让失败', icon: 'none' });
        }
      }
    });
  },

  getPlayerName(userId) {
    const member = this.data.members.find((m) => m.userId === userId);
    return member ? member.nickname : '未知';
  },

  async startGame() {
    if (this.data.members.length < 2) {
      wx.showToast({
        title: '至少需要2人才能开始',
        icon: 'none'
      });
      return;
    }

    try {
      await roomService.startRoom(this.data.roomId);
      wx.showToast({
        title: '牌局开始',
        icon: 'success'
      });
      this.loadRoomDetail();
      this.ensureSocket();
    } catch (err) {
      wx.showToast({
        title: err.message || '开始失败',
        icon: 'none'
      });
    }
  },

  endGame() {
    wx.showModal({
      title: '确认结束',
      content: '结束牌局后将进行最终结算，确认结束吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await roomService.endRoom(this.data.roomId);
            wx.showToast({
              title: '牌局已结束',
              icon: 'success'
            });
            this.teardownSocket();
            this.loadRoomDetail();
          } catch (err) {
            wx.showToast({
              title: err.message || '结束失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  goToRecordScore() {
    wx.navigateTo({
      url: `/pages/score/record?roomId=${this.data.roomId}&roundNo=${this.data.currentRound + 1}`
    });
  },

  viewScoreHistory() {
    wx.navigateTo({
      url: `/pages/score/history?roomId=${this.data.roomId}`
    });
  },

  copyRoomNo() {
    const no = this.data.room && this.data.room.roomNo;
    if (!no) {
      return;
    }
    wx.setClipboardData({
      data: String(no),
      success: () => wx.showToast({ title: '房间号已复制', icon: 'none' })
    });
  },

  // 跳转编辑页（仅房主、等待中由后端再校验）
  goEditRoom() {
    wx.navigateTo({
      url: `/pages/room/create?id=${this.data.roomId}`
    });
  },

  // 删除本人发布的等待中牌局
  confirmDeleteRoom() {
    wx.showModal({
      title: '删除牌局',
      content: '确定删除该牌局吗？删除后不可恢复。',
      success: async (r) => {
        if (!r.confirm) {
          return;
        }
        try {
          wx.showLoading({ title: '删除中' });
          await roomService.deleteRoom(this.data.roomId);
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          this.teardownSocket();
          wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' });
        }
      }
    });
  },

  onShareAppMessage() {
    return {
      title: `快来加入我的牌局！房间号: ${this.data.room.roomNo}`,
      path: `/pages/room/detail?id=${this.data.roomId}`,
      imageUrl: '/images/share-room.png'
    };
  }
});
