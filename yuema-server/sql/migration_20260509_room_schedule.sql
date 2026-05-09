-- 计划开始时间窗口与预计牌局时长（与实际开局 start_time 分离）
ALTER TABLE rooms ADD COLUMN start_window_begin DATETIME NULL DEFAULT NULL COMMENT '计划开始时间窗口起点' AFTER end_time;
ALTER TABLE rooms ADD COLUMN start_window_end DATETIME NULL DEFAULT NULL COMMENT '计划开始时间窗口终点' AFTER start_window_begin;
ALTER TABLE rooms ADD COLUMN duration_minutes INT NULL DEFAULT NULL COMMENT '预计牌局时长(分钟)' AFTER start_window_end;
