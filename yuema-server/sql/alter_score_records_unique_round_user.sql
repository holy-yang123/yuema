-- 同一牌局、同一局号、同一用户仅一条记分行，防止并发双写（与 ScoreService.recordScores 一致）
-- 若表中已存在重复 (room_id, round_no, user_id)，须先清洗后再执行本脚本
ALTER TABLE score_records
    ADD UNIQUE KEY uk_room_round_user (room_id, round_no, user_id);
