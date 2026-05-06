package com.yuema.server.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.yuema.server.dto.ScoreRecordDTO;
import com.yuema.server.entity.Room;
import com.yuema.server.entity.RoomMember;
import com.yuema.server.entity.ScoreRecord;
import com.yuema.server.mapper.RoomMapper;
import com.yuema.server.mapper.RoomMemberMapper;
import com.yuema.server.mapper.ScoreRecordMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class ScoreService extends ServiceImpl<ScoreRecordMapper, ScoreRecord> {

    @Autowired
    private RoomMapper roomMapper;

    @Autowired
    private RoomMemberMapper roomMemberMapper;

    @Transactional
    public boolean recordScores(Long recorderId, ScoreRecordDTO dto) {
        Room room = roomMapper.selectById(dto.getRoomId());
        if (room == null || room.getStatus() != 1) {
            return false;
        }

        // 检查该局是否已记录
        List<ScoreRecord> existingRecords = baseMapper.selectByRoomAndRound(dto.getRoomId(), dto.getRoundNo());
        if (!existingRecords.isEmpty()) {
            // 删除旧记录
            existingRecords.forEach(record -> removeById(record.getId()));
        }

        // 保存新记录
        for (ScoreRecordDTO.PlayerScoreDTO playerScore : dto.getPlayerScores()) {
            ScoreRecord record = new ScoreRecord();
            record.setRoomId(dto.getRoomId());
            record.setRoundNo(dto.getRoundNo());
            record.setUserId(playerScore.getUserId());
            record.setScoreChange(playerScore.getScoreChange());
            record.setScoreType(dto.getScoreType());
            record.setRecorderId(recorderId);
            record.setStatus(1);
            record.setRemark(dto.getRemark());
            save(record);
        }

        return true;
    }

    public List<ScoreRecord> getRoomScores(Long roomId) {
        return baseMapper.selectByRoomId(roomId);
    }

    public Map<String, Object> getScoreSummary(Long roomId) {
        List<Map<String, Object>> summaryList = baseMapper.selectScoreSummary(roomId);
        Map<Long, Integer> scoreMap = new HashMap<>();

        for (Map<String, Object> item : summaryList) {
            Long userId = ((Number) item.get("user_id")).longValue();
            Integer totalScore = ((Number) item.get("total_score")).intValue();
            scoreMap.put(userId, totalScore);
        }

        // 获取牌局成员
        List<RoomMember> members = roomMemberMapper.selectActiveMembers(roomId);
        List<Map<String, Object>> memberScores = new ArrayList<>();

        for (RoomMember member : members) {
            Map<String, Object> memberScore = new HashMap<>();
            memberScore.put("userId", member.getUserId());
            memberScore.put("finalScore", scoreMap.getOrDefault(member.getUserId(), 0));
            memberScores.add(memberScore);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("roomId", roomId);
        result.put("totalRounds", getTotalRounds(roomId));
        result.put("memberScores", memberScores);

        return result;
    }

    public Integer getTotalRounds(Long roomId) {
        Integer maxRound = baseMapper.selectMaxRoundNo(roomId);
        return maxRound != null ? maxRound : 0;
    }

    public List<ScoreRecord> getRoundScores(Long roomId, Integer roundNo) {
        return baseMapper.selectByRoomAndRound(roomId, roundNo);
    }

    @Transactional
    public boolean deleteRoundScore(Long roomId, Integer roundNo, Long userId) {
        // 检查权限
        Room room = roomMapper.selectById(roomId);
        if (room == null) {
            return false;
        }

        RoomMember member = roomMemberMapper.selectByRoomAndUser(roomId, userId);
        if (member == null || (member.getRole() != 1 && !isRecorder(roomId, roundNo, userId))) {
            return false;
        }

        List<ScoreRecord> records = baseMapper.selectByRoomAndRound(roomId, roundNo);
        for (ScoreRecord record : records) {
            removeById(record.getId());
        }

        return true;
    }

    private boolean isRecorder(Long roomId, Integer roundNo, Long userId) {
        List<ScoreRecord> records = baseMapper.selectByRoomAndRound(roomId, roundNo);
        if (records.isEmpty()) {
            return false;
        }
        return records.get(0).getRecorderId().equals(userId);
    }

    public Map<String, Object> calculateSettlement(Long roomId) {
        Map<String, Object> summary = getScoreSummary(roomId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> memberScores = (List<Map<String, Object>>) summary.get("memberScores");

        // 计算输赢
        List<Map<String, Object>> settlements = new ArrayList<>();
        int totalScore = 0;

        for (Map<String, Object> memberScore : memberScores) {
            Integer score = (Integer) memberScore.get("finalScore");
            totalScore += score;
        }

        // 验证总分是否为0
        boolean isValid = totalScore == 0;

        for (Map<String, Object> memberScore : memberScores) {
            Long userId = ((Number) memberScore.get("userId")).longValue();
            Integer score = (Integer) memberScore.get("finalScore");

            Map<String, Object> settlement = new HashMap<>();
            settlement.put("userId", userId);
            settlement.put("score", score);
            settlement.put("amount", score); // 1分 = 1元，可根据底分调整
            settlements.add(settlement);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("roomId", roomId);
        result.put("isValid", isValid);
        result.put("totalScore", totalScore);
        result.put("settlements", settlements);

        return result;
    }
}
