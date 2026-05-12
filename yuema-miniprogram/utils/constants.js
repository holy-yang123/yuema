/**
 * 业务常量定义
 */
module.exports = {
  // 房间状态
  ROOM_STATUS: {
    WAITING: 0,   // 等待中
    PLAYING: 1,   // 进行中
    FINISHED: 2   // 已结束
  },
  
  // 游戏类型
  GAME_TYPES: {
    MAHJONG: 'mahjong',
    POKER: 'poker'
  },
  
  // HTTP 响应状态码
  HTTP_CODE: {
    SUCCESS: 200,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    SERVER_ERROR: 500
  },
  
  // 业务逻辑代码
  BUSINESS_CODE: {
    SUCCESS: 200,
    NEED_PROFILE: 404 // 针对登录接口，表示需要补充用户信息
  }
};
