-- 信誉分、微信侧可信身份、爽约记录（在已有 yuema 库执行一次）
ALTER TABLE users
    ADD COLUMN reputation_score INT NOT NULL DEFAULT 100 COMMENT '信誉分，爽约等扣减' AFTER win_games,
    ADD COLUMN realname_verified TINYINT NOT NULL DEFAULT 0 COMMENT '可信身份：微信手机号核验等 0否1是' AFTER reputation_score;

CREATE TABLE IF NOT EXISTS room_no_show_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    room_id BIGINT NOT NULL COMMENT '牌局',
    target_user_id BIGINT NOT NULL COMMENT '被认定爽约的用户',
    reporter_id BIGINT NOT NULL COMMENT '操作人(房主)',
    deducted_points INT NOT NULL COMMENT '本次扣除信誉分',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
    UNIQUE KEY uk_room_target (room_id, target_user_id),
    INDEX idx_target (target_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='爽约扣分明细(每局每用户仅一次)';
