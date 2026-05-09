package com.yuema.server.service;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.yuema.server.dto.ScoreRecordDTO;
import com.yuema.server.entity.Room;
import com.yuema.server.entity.RoomMember;
import com.yuema.server.entity.ScoreModifyRequest;
import com.yuema.server.entity.ScoreModifyVote;
import com.yuema.server.entity.ScoreRecord;
import com.yuema.server.mapper.RoomMapper;
import com.yuema.server.mapper.RoomMemberMapper;
import com.yuema.server.mapper.ScoreModifyRequestMapper;
import com.yuema.server.mapper.ScoreModifyVoteMapper;
import com.yuema.server.mapper.ScoreRecordMapper;
import com.yuema.server.websocket.RoomWebSocketHandler;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ScoreModifyService {

    private static final int STATUS_PENDING = 0;
    private static final int STATUS_APPROVED = 1;
    private static final int STATUS_REJECTED = 2;
    private static final int STATUS_CANCELED = 3;

    private static final int VOTE_APPROVE = 1;
    private static final int VOTE_REJECT = 2;

    @Autowired
    private RoomMapper roomMapper;

    @Autowired
    private RoomMemberMapper roomMemberMapper;

    @Autowired
    private ScoreModifyRequestMapper requestMapper;

    @Autowired
    private ScoreModifyVoteMapper voteMapper;

    @Autowired
    private ScoreRecordMapper scoreRecordMapper;

    @Autowired
    private RoomWebSocketHandler roomWebSocketHandler;

    /**
     * 创建修改申请：先查「是否已有待处理」再 insert，极端并发下仍可能双插；
     * 若需硬防可在库上为「待处理」维度加唯一约束（如虚拟列 + UNIQUE），当前与业务频率由应用层事务承担。
     */
    @Transactional
    public String createRequest(Long userId, ScoreRecordDTO dto) {
        Room room = roomMapper.selectById(dto.getRoomId());
        if (room == null || room.getStatus() == null || room.getStatus() != 1) {
            return "ROOM_INVALID";
        }
        if (dto.getPlayerScores() == null || dto.getPlayerScores().isEmpty()) {
            return "BAD_PAYLOAD";
        }
        if (!room.getCreatorId().equals(userId)) {
            return "NOT_HOST";
        }
        List<ScoreRecord> existing = scoreRecordMapper.selectByRoomAndRound(dto.getRoomId(), dto.getRoundNo());
        if (existing.isEmpty()) {
            return "NO_SCORE";
        }
        if (requestMapper.selectLatestPending(dto.getRoomId()) != null) {
            return "PENDING_EXISTS";
        }
        int required = countRequiredVoters(room.getId(), room.getCreatorId());
        if (required <= 0) {
            return "NO_VOTERS";
        }

        String payload = JSON.toJSONString(dto.getPlayerScores());
        ScoreModifyRequest req = new ScoreModifyRequest();
        req.setRoomId(dto.getRoomId());
        req.setRoundNo(dto.getRoundNo());
        req.setRequesterId(userId);
        req.setNewPayload(payload);
        req.setNewScoreType(dto.getScoreType());
        req.setNewRemark(dto.getRemark());
        req.setStatus(STATUS_PENDING);
        req.setCreatedAt(LocalDateTime.now());
        requestMapper.insert(req);

        Map<String, Object> push = new HashMap<>();
        push.put("requestId", req.getId());
        push.put("roomId", dto.getRoomId());
        push.put("roundNo", dto.getRoundNo());
        push.put("requesterId", userId);
        push.put("playerScores", dto.getPlayerScores());
        push.put("scoreType", dto.getScoreType());
        push.put("remark", dto.getRemark());
        push.put("requiredVotes", required);
        roomWebSocketHandler.broadcast(dto.getRoomId(), "score_modify_request", push);

        return null;
    }

    private int countRequiredVoters(Long roomId, Long creatorId) {
        List<RoomMember> members = roomMemberMapper.selectActiveMembers(roomId);
        return (int) members.stream()
                .filter(m -> m.getUserId() != null && !m.getUserId().equals(creatorId))
                .count();
    }

    @Transactional
    public String vote(Long userId, Long requestId, int vote) {
        ScoreModifyRequest req = requestMapper.selectById(requestId);
        if (req == null || req.getStatus() == null || req.getStatus() != STATUS_PENDING) {
            return "INVALID";
        }
        if (req.getRequesterId().equals(userId)) {
            return "HOST_CANNOT_VOTE";
        }
        RoomMember member = roomMemberMapper.selectByRoomAndUser(req.getRoomId(), userId);
        if (member == null || member.getStatus() == null || member.getStatus() != 1) {
            return "NOT_MEMBER";
        }
        if (vote != VOTE_APPROVE && vote != VOTE_REJECT) {
            return "BAD_VOTE";
        }

        if (vote == VOTE_REJECT) {
            req.setStatus(STATUS_REJECTED);
            requestMapper.updateById(req);
            Map<String, Object> data = new HashMap<>();
            data.put("requestId", requestId);
            data.put("status", "rejected");
            data.put("voterId", userId);
            roomWebSocketHandler.broadcast(req.getRoomId(), "score_modify_finalized", data);
            return null;
        }

        long existingVotes = voteMapper.selectCount(Wrappers.<ScoreModifyVote>lambdaQuery()
                .eq(ScoreModifyVote::getRequestId, requestId)
                .eq(ScoreModifyVote::getVoterId, userId));
        if (existingVotes > 0) {
            return "ALREADY_VOTED";
        }

        ScoreModifyVote v = new ScoreModifyVote();
        v.setRequestId(requestId);
        v.setVoterId(userId);
        v.setVote(VOTE_APPROVE);
        v.setVotedAt(LocalDateTime.now());
        voteMapper.insert(v);

        Room room = roomMapper.selectById(req.getRoomId());
        int required = countRequiredVoters(req.getRoomId(), room.getCreatorId());
        int approvals = voteMapper.countApprovals(requestId);

        Map<String, Object> progress = new HashMap<>();
        progress.put("requestId", requestId);
        progress.put("approvals", approvals);
        progress.put("requiredVotes", required);
        roomWebSocketHandler.broadcast(req.getRoomId(), "score_modify_vote_update", progress);

        if (approvals >= required) {
            applyApproved(req);
        }
        return null;
    }

    private void applyApproved(ScoreModifyRequest req) {
        scoreRecordMapper.invalidateRoundRecords(req.getRoomId(), req.getRoundNo());

        JSONArray arr = JSON.parseArray(req.getNewPayload());
        for (int i = 0; i < arr.size(); i++) {
            JSONObject o = arr.getJSONObject(i);
            Long uid = o.getLong("userId");
            Integer sc = o.getInteger("scoreChange");
            ScoreRecord record = new ScoreRecord();
            record.setRoomId(req.getRoomId());
            record.setRoundNo(req.getRoundNo());
            record.setUserId(uid);
            record.setScoreChange(sc);
            record.setScoreType(req.getNewScoreType());
            record.setRecorderId(req.getRequesterId());
            record.setStatus(1);
            record.setRemark(req.getNewRemark());
            scoreRecordMapper.insert(record);
        }

        req.setStatus(STATUS_APPROVED);
        requestMapper.updateById(req);

        Map<String, Object> data = new HashMap<>();
        data.put("requestId", req.getId());
        data.put("status", "approved");
        data.put("roomId", req.getRoomId());
        data.put("roundNo", req.getRoundNo());
        roomWebSocketHandler.broadcast(req.getRoomId(), "score_modify_finalized", data);
    }

    @Transactional
    public String cancel(Long userId, Long requestId) {
        ScoreModifyRequest req = requestMapper.selectById(requestId);
        if (req == null || req.getStatus() == null || req.getStatus() != STATUS_PENDING) {
            return "INVALID";
        }
        if (!req.getRequesterId().equals(userId)) {
            return "NOT_HOST";
        }
        req.setStatus(STATUS_CANCELED);
        requestMapper.updateById(req);
        Map<String, Object> data = new HashMap<>();
        data.put("requestId", requestId);
        data.put("status", "canceled");
        roomWebSocketHandler.broadcast(req.getRoomId(), "score_modify_finalized", data);
        return null;
    }

    public Map<String, Object> getPending(Long userId, Long roomId) {
        if (!isActiveMember(roomId, userId)) {
            return null;
        }
        ScoreModifyRequest req = requestMapper.selectLatestPending(roomId);
        if (req == null) {
            return new HashMap<>();
        }
        Room room = roomMapper.selectById(roomId);
        int required = countRequiredVoters(roomId, room.getCreatorId());
        List<ScoreModifyVote> votes = voteMapper.selectList(Wrappers.<ScoreModifyVote>lambdaQuery()
                .eq(ScoreModifyVote::getRequestId, req.getId()));

        Map<String, Object> out = new HashMap<>();
        out.put("request", req);
        out.put("votes", votes);
        out.put("requiredVotes", required);
        out.put("playerScores", JSON.parseArray(req.getNewPayload()));
        return out;
    }

    private boolean isActiveMember(Long roomId, Long userId) {
        RoomMember m = roomMemberMapper.selectByRoomAndUser(roomId, userId);
        return m != null && m.getStatus() != null && m.getStatus() == 1;
    }
}
