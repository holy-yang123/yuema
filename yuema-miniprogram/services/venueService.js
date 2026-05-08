const request = require('../utils/request');

module.exports = {
  // 获取场地列表
  getVenueList() {
    return request.get('/venue/list');
  },

  // 获取附近场地
  getNearbyVenues(longitude, latitude, limit = 10) {
    return request.get('/venue/nearby', { longitude, latitude, limit });
  },

  // 获取场地详情
  getVenueDetail(venueId) {
    return request.get('/venue/detail', { venueId });
  },

  /** 与 getVenueDetail 同义，兼容旧页面调用 */
  getVenueInfo(venueId) {
    return request.get('/venue/detail', { venueId });
  },

  // 获取场地包间
  getVenueRooms(venueId) {
    return request.get('/venue/rooms', { venueId });
  }
};
