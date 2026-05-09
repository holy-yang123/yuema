-- 现有库增量：牌局玩法细则（按玩法分桶 JSON）
ALTER TABLE rooms ADD COLUMN game_rules TEXT DEFAULT NULL COMMENT '玩法细则(JSON，按 game_type 分桶)' AFTER remark;
