const request = require('../utils/request');

module.exports = {
  // 记录分数
  recordScores(data) {
    return request.post('/score/record', data);
  },

  /**
   * 按局分组的历史（供 history 页）
   */
  async getScoreHistory(roomId) {
    const res = await request.get('/score/list', { roomId });
    const records = res.data || [];
    const byRound = {};
    records.forEach((r) => {
      const k = r.roundNo;
      if (!byRound[k]) byRound[k] = [];
      byRound[k].push(r);
    });
    const history = Object.keys(byRound)
      .map((k) => Number(k))
      .sort((a, b) => a - b)
      .map((roundNo) => ({
        roundNo,
        scoreType: (byRound[roundNo][0] && byRound[roundNo][0].scoreType) || '',
        records: byRound[roundNo]
      }));
    return { ...res, data: history };
  },

  // 获取牌局所有分数记录
  getRoomScores(roomId) {
    return request.get('/score/list', { roomId });
  },

  // 获取分数汇总
  getScoreSummary(roomId) {
    return request.get('/score/summary', { roomId });
  },

  // 获取某一局分数
  getRoundScores(roomId, roundNo) {
    return request.get('/score/round', { roomId, roundNo });
  },

  // 删除某一局分数
  deleteRoundScore(roomId, roundNo) {
    return request.del('/score/round', { roomId, roundNo });
  },

  // 获取结算信息
  getSettlement(roomId) {
    return request.get('/score/settlement', { roomId });
  }
};
