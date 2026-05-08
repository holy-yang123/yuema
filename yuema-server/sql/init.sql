-- 约麻小程序数据库初始化脚本
-- 创建数据库
CREATE DATABASE IF NOT EXISTS yuema DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE yuema;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
    openid VARCHAR(64) UNIQUE NOT NULL COMMENT '微信openid',
    unionid VARCHAR(64) DEFAULT NULL COMMENT '微信unionid',
    nickname VARCHAR(64) DEFAULT NULL COMMENT '昵称',
    avatar_url VARCHAR(255) DEFAULT NULL COMMENT '头像URL',
    phone VARCHAR(20) DEFAULT NULL COMMENT '手机号',
    gender TINYINT DEFAULT 0 COMMENT '性别 0:未知 1:男 2:女',
    level INT DEFAULT 1 COMMENT '等级',
    score INT DEFAULT 0 COMMENT '积分',
    total_games INT DEFAULT 0 COMMENT '总对局数',
    win_games INT DEFAULT 0 COMMENT '胜局数',
    status TINYINT DEFAULT 1 COMMENT '状态 0:禁用 1:正常',
    last_login_time TIMESTAMP NULL DEFAULT NULL COMMENT '最后登录时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除 0:否 1:是',
    INDEX idx_openid (openid),
    INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 牌局表
CREATE TABLE IF NOT EXISTS rooms (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '牌局ID',
    room_no VARCHAR(20) UNIQUE NOT NULL COMMENT '房间号',
    creator_id BIGINT NOT NULL COMMENT '创建者ID',
    status TINYINT DEFAULT 0 COMMENT '状态 0:待开始 1:进行中 2:已结束',
    game_type VARCHAR(32) DEFAULT 'sichuan' COMMENT '玩法类型 sichuan:川麻 guobiao:国标 guangdong:广东麻将',
    max_players INT DEFAULT 4 COMMENT '最大人数',
    current_players INT DEFAULT 0 COMMENT '当前人数',
    venue_id BIGINT DEFAULT NULL COMMENT '场地ID',
    venue_name VARCHAR(128) DEFAULT NULL COMMENT '场地名称（缓存）',
    start_time TIMESTAMP NULL DEFAULT NULL COMMENT '开始时间',
    end_time TIMESTAMP NULL DEFAULT NULL COMMENT '结束时间',
    base_score INT DEFAULT 1 COMMENT '底分',
    tai_fee INT DEFAULT 0 COMMENT '台费',
    longitude DECIMAL(10,7) DEFAULT NULL COMMENT '经度',
    latitude DECIMAL(10,7) DEFAULT NULL COMMENT '纬度',
    remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除',
    INDEX idx_room_no (room_no),
    INDEX idx_creator_id (creator_id),
    INDEX idx_status (status),
    INDEX idx_venue_id (venue_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='牌局表';

-- 牌局成员表
CREATE TABLE IF NOT EXISTS room_members (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID',
    room_id BIGINT NOT NULL COMMENT '牌局ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    role TINYINT DEFAULT 0 COMMENT '角色 0:成员 1:房主',
    status TINYINT DEFAULT 0 COMMENT '状态 0:待确认 1:已确认 2:已拒绝 3:已离开',
    seat_no INT DEFAULT NULL COMMENT '座位号 1-4',
    final_score INT DEFAULT 0 COMMENT '最终得分',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_room_user (room_id, user_id),
    INDEX idx_room_id (room_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='牌局成员表';

-- 计分记录表
CREATE TABLE IF NOT EXISTS score_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID',
    room_id BIGINT NOT NULL COMMENT '牌局ID',
    round_no INT NOT NULL COMMENT '局数序号',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    score_change INT NOT NULL COMMENT '分数变化',
    score_type VARCHAR(32) DEFAULT NULL COMMENT '计分类型 自摸/点炮/杠上花/暗杠/明杠等',
    recorder_id BIGINT NOT NULL COMMENT '记分操作人ID',
    status TINYINT DEFAULT 1 COMMENT '状态 0:待确认 1:已确认 2:已修改',
    remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_room_id (room_id),
    INDEX idx_user_id (user_id),
    INDEX idx_round_no (room_id, round_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='计分记录表';

-- 场地表
CREATE TABLE IF NOT EXISTS venues (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '场地ID',
    name VARCHAR(128) NOT NULL COMMENT '场地名称',
    address VARCHAR(255) DEFAULT NULL COMMENT '详细地址',
    longitude DECIMAL(10,7) DEFAULT NULL COMMENT '经度',
    latitude DECIMAL(10,7) DEFAULT NULL COMMENT '纬度',
    phone VARCHAR(20) DEFAULT NULL COMMENT '联系电话',
    business_hours VARCHAR(64) DEFAULT NULL COMMENT '营业时间',
    rating DECIMAL(2,1) DEFAULT 5.0 COMMENT '评分',
    image_urls TEXT DEFAULT NULL COMMENT '场地图片URL列表(JSON数组)',
    facilities VARCHAR(255) DEFAULT NULL COMMENT '设施标签 空调/新风/免费茶水等',
    min_price INT DEFAULT 0 COMMENT '最低价格(分)',
    max_price INT DEFAULT 0 COMMENT '最高价格(分)',
    status TINYINT DEFAULT 1 COMMENT '状态 0:停用 1:正常',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '是否删除',
    INDEX idx_location (longitude, latitude),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='场地表';

-- 包间表
CREATE TABLE IF NOT EXISTS venue_rooms (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID',
    venue_id BIGINT NOT NULL COMMENT '场地ID',
    name VARCHAR(64) NOT NULL COMMENT '包间名称',
    room_type VARCHAR(32) DEFAULT 'standard' COMMENT '包间类型 standard:标准 vip:豪华',
    capacity INT DEFAULT 4 COMMENT '容纳人数',
    price_per_hour INT DEFAULT 0 COMMENT '每小时价格(分)',
    image_urls TEXT DEFAULT NULL COMMENT '包间图片URL列表',
    facilities VARCHAR(255) DEFAULT NULL COMMENT '包间设施',
    status TINYINT DEFAULT 1 COMMENT '状态 0:停用 1:正常',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_venue_id (venue_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='包间表';

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '订单ID',
    order_no VARCHAR(32) UNIQUE NOT NULL COMMENT '订单编号',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    venue_id BIGINT NOT NULL COMMENT '场地ID',
    venue_room_id BIGINT NOT NULL COMMENT '包间ID',
    room_id BIGINT DEFAULT NULL COMMENT '关联牌局ID',
    booking_date DATE NOT NULL COMMENT '预订日期',
    start_time TIME NOT NULL COMMENT '开始时间',
    end_time TIME NOT NULL COMMENT '结束时间',
    duration_hours INT DEFAULT 4 COMMENT '预订时长(小时)',
    total_amount INT NOT NULL COMMENT '订单金额(分)',
    pay_amount INT NOT NULL COMMENT '实付金额(分)',
    status TINYINT DEFAULT 0 COMMENT '状态 0:待支付 1:已支付 2:已确认 3:进行中 4:已完成 5:已取消 6:退款中 7:已退款',
    pay_time TIMESTAMP NULL DEFAULT NULL COMMENT '支付时间',
    pay_type VARCHAR(32) DEFAULT NULL COMMENT '支付方式 wechat:微信支付',
    pay_transaction_id VARCHAR(64) DEFAULT NULL COMMENT '微信支付流水号',
    remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_order_no (order_no),
    INDEX idx_user_id (user_id),
    INDEX idx_venue_id (venue_id),
    INDEX idx_status (status),
    INDEX idx_booking_date (booking_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- 好友关系表
CREATE TABLE IF NOT EXISTS friendships (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    friend_id BIGINT NOT NULL COMMENT '好友ID',
    status TINYINT DEFAULT 0 COMMENT '状态 0:待确认 1:已确认 2:已拒绝 3:已删除',
    remark_name VARCHAR(64) DEFAULT NULL COMMENT '备注名',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_user_friend (user_id, friend_id),
    INDEX idx_user_id (user_id),
    INDEX idx_friend_id (friend_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='好友关系表';

-- 用户评价表
CREATE TABLE IF NOT EXISTS user_reviews (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID',
    reviewer_id BIGINT NOT NULL COMMENT '评价人ID',
    reviewee_id BIGINT NOT NULL COMMENT '被评价人ID',
    room_id BIGINT DEFAULT NULL COMMENT '关联牌局ID',
    rating TINYINT DEFAULT 5 COMMENT '评分 1-5',
    content VARCHAR(500) DEFAULT NULL COMMENT '评价内容',
    tags VARCHAR(255) DEFAULT NULL COMMENT '标签 牌品好/技术好/守时等',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_reviewer (reviewer_id),
    INDEX idx_reviewee (reviewee_id),
    INDEX idx_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户评价表';

-- 牌局聊天消息
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID',
    room_id BIGINT NOT NULL COMMENT '牌局ID',
    user_id BIGINT NOT NULL COMMENT '发送者',
    msg_type VARCHAR(16) NOT NULL DEFAULT 'text' COMMENT 'text/system',
    content VARCHAR(500) NOT NULL COMMENT '内容',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '时间',
    INDEX idx_room_created (room_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='牌局聊天';

-- 计分修改申请
CREATE TABLE IF NOT EXISTS score_modify_requests (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID',
    room_id BIGINT NOT NULL COMMENT '牌局ID',
    round_no INT NOT NULL COMMENT '局号',
    requester_id BIGINT NOT NULL COMMENT '房主',
    new_payload TEXT NOT NULL COMMENT 'JSON: [{userId,scoreChange}]',
    new_score_type VARCHAR(32) DEFAULT NULL,
    new_remark VARCHAR(255) DEFAULT NULL,
    status TINYINT NOT NULL DEFAULT 0 COMMENT '0:待处理 1:已通过 2:已拒绝 3:已取消',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_room_status (room_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='计分修改申请';

CREATE TABLE IF NOT EXISTS score_modify_votes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID',
    request_id BIGINT NOT NULL COMMENT '申请ID',
    voter_id BIGINT NOT NULL COMMENT '投票人',
    vote TINYINT NOT NULL COMMENT '1:同意 2:拒绝',
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_req_voter (request_id, voter_id),
    INDEX idx_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='计分修改投票';

-- 用户单局战绩快照（牌局结束时写入）
CREATE TABLE IF NOT EXISTS user_game_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID',
    user_id BIGINT NOT NULL COMMENT '用户',
    room_id BIGINT NOT NULL COMMENT '牌局',
    game_type VARCHAR(32) DEFAULT NULL,
    venue_name VARCHAR(128) DEFAULT NULL,
    rounds INT DEFAULT 0 COMMENT '总局数',
    final_score INT DEFAULT 0 COMMENT '本场累计分',
    is_winner TINYINT DEFAULT 0 COMMENT '1:本场总分>0',
    started_at TIMESTAMP NULL DEFAULT NULL,
    ended_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_ended (user_id, ended_at DESC),
    INDEX idx_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户战绩快照';

-- 插入测试数据
INSERT INTO users (openid, nickname, avatar_url, phone, level, status) VALUES
('test_openid_1', '测试用户1', 'https://example.com/avatar1.jpg', '13800138001', 1, 1),
('test_openid_2', '测试用户2', 'https://example.com/avatar2.jpg', '13800138002', 2, 1),
('test_openid_3', '测试用户3', 'https://example.com/avatar3.jpg', '13800138003', 3, 1);

INSERT INTO venues (name, address, longitude, latitude, phone, business_hours, rating, facilities, min_price, max_price, status) VALUES
('四个朋友棋牌室(测试店)', '北京市朝阳区测试路1号', 116.4074, 39.9042, '010-12345678', '09:00-02:00', 4.5, '空调,新风,免费茶水,WiFi', 4000, 8000, 1),
('麻利友自助棋牌', '上海市浦东新区测试路2号', 121.4737, 31.2304, '021-87654321', '24小时营业', 4.8, '空调,新风,免费茶水,零食,WiFi', 3000, 6000, 1);

INSERT INTO venue_rooms (venue_id, name, room_type, capacity, price_per_hour, facilities, status) VALUES
(1, '豪华大包', 'vip', 4, 5000, '自动麻将机,沙发,茶几,空调', 1),
(1, '标准中包', 'standard', 4, 3500, '自动麻将机,空调', 1),
(2, '普通包间A', 'standard', 4, 2500, '自动麻将机,空调', 1),
(2, '普通包间B', 'standard', 4, 2500, '自动麻将机,空调', 1);
