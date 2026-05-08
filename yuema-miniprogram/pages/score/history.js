const scoreService = require('../../services/scoreService');
const roomService = require('../../services/roomService');

const gameTypeMap = {
  sichuan: '四川麻将',
  guobiao: '国标麻将',
  guangdong: '广东麻将'
};

Page({
  data: {
    history: [],
    roomNo: '',
    gameType: ''
  },

  onLoad(options) {
    if (options.roomId) {
      this.loadHistory(options.roomId);
    }
  },

  async loadHistory(roomId) {
    try {
      const [roomRes, histRes] = await Promise.all([
        roomService.getRoomInfo(roomId),
        scoreService.getScoreHistory(roomId)
      ]);
      const room = roomRes.data.room;
      const members = roomRes.data.members || [];
      const nick = (uid) => {
        const m = members.find((x) => x.userId === uid);
        return m ? m.nickname : '未知';
      };
      const rounds = histRes.data || [];
      const history = rounds.map((round) => {
        const first = round.records && round.records[0];
        const time = first && first.createdAt ? String(first.createdAt).slice(0, 16) : '';
        return {
          roundNo: round.roundNo,
          time,
          playerScores: (round.records || []).map((r) => ({
            userId: r.userId,
            nickname: nick(r.userId),
            scoreChange: r.scoreChange
          }))
        };
      });
      this.setData({
        roomNo: room.roomNo || '',
        gameType: gameTypeMap[room.gameType] || room.gameType || '',
        history
      });
    } catch (err) {
      console.error('加载计分历史失败:', err);
    }
  }
});
