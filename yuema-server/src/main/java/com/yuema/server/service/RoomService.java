package com.yuema.server.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.yuema.server.dto.CreateRoomDTO;
import com.yuema.server.entity.Room;
import com.yuema.server.entity.RoomMember;
import com.yuema.server.entity.UserGameRecord;
import com.yuema.server.entity.Venue;
import com.yuema.server.mapper.RoomMapper;
import com.yuema.server.mapper.RoomMemberMapper;
import com.yuema.server.mapper.UserGameRecordMapper;
import com.yuema.server.mapper.VenueMapper;
import com.yuema.server.websocket.RoomWebSocketHandler;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

@Service
public class RoomService extends ServiceImpl<RoomMapper, Room> {

    @Autowired
    private RoomMemberMapper roomMemberMapper;

    @Autowired
    private VenueMapper venueMapper;

    @Autowired
    private ScoreService scoreService;

    @Autowired
    private UserService userService;

    @Autowired
    private UserGameRecordMapper userGameRecordMapper;

    @Autowired
    private RoomWebSocketHandler roomWebSocketHandler;

    @Transactional
    public Room createRoom(Long creatorId, CreateRoomDTO dto) {
        Room room = new Room();
        room.setRoomNo(generateRoomNo());
        room.setCreatorId(creatorId);
        room.setStatus(0);
        room.setGameType(dto.getGameType());
        room.setMaxPlayers(dto.getMaxPlayers());
        room.setCurrentPlayers(1);
        room.setVenueId(dto.getVenueId());
        room.setLongitude(dto.getLongitude());
        room.setLatitude(dto.getLatitude());

        if (dto.getVenueId() != null) {
            Venue venue = venueMapper.selectById(dto.getVenueId());
            if (venue != null) {
                room.setVenueName(venue.getName());
                // 如果房间没有指定经纬度，则使用场地的经纬度
                if (room.getLongitude() == null) room.setLongitude(venue.getLongitude());
                if (room.getLatitude() == null) room.setLatitude(venue.getLatitude());
            }
        }

        room.setStartTime(dto.getStartTime());
        room.setBaseScore(dto.getBaseScore() != null ? dto.getBaseScore() : 1);
        room.setTaiFee(dto.getTaiFee() != null ? dto.getTaiFee() : 0);
        room.setRemark(dto.getRemark());

        save(room);

        // 创建者自动加入牌局
        RoomMember member = new RoomMember();
        member.setRoomId(room.getId());
        member.setUserId(creatorId);
        member.setRole(1);
        member.setStatus(1);
        member.setSeatNo(1);
        member.setJoinedAt(LocalDateTime.now());
        roomMemberMapper.insert(member);

        return room;
    }

    public Room getByRoomNo(String roomNo) {
        return baseMapper.selectByRoomNo(roomNo);
    }

    public List<Room> getActiveRooms(Double longitude, Double latitude) {
        if (longitude != null && latitude != null) {
            return baseMapper.selectNearbyRooms(0, longitude, latitude);
        }
        return baseMapper.selectNearbyRooms(0, 0.0, 0.0); // 默认排序
    }

    public List<Room> getMyRooms(Long userId) {
        return baseMapper.selectByCreatorId(userId);
    }

    @Transactional
    public boolean joinRoom(Long roomId, Long userId) {
        Room room = getById(roomId);
        if (room == null || room.getStatus() != 0) {
            return false;
        }

        // 检查是否已在牌局中
        RoomMember existing = roomMemberMapper.selectByRoomAndUser(roomId, userId);
        if (existing != null) {
            return existing.getStatus() == 1;
        }

        // 检查人数
        int count = roomMemberMapper.countActiveMembers(roomId);
        if (count >= room.getMaxPlayers()) {
            return false;
        }

        RoomMember member = new RoomMember();
        member.setRoomId(roomId);
        member.setUserId(userId);
        member.setRole(0);
        member.setStatus(1);
        member.setSeatNo(count + 1);
        member.setJoinedAt(LocalDateTime.now());
        roomMemberMapper.insert(member);

        // 更新当前人数
        room.setCurrentPlayers(count + 1);
        updateById(room);

        return true;
    }

    @Transactional
    public boolean startRoom(Long roomId, Long userId) {
        Room room = getById(roomId);
        if (room == null || !room.getCreatorId().equals(userId)) {
            return false;
        }

        room.setStatus(1);
        room.setStartTime(LocalDateTime.now());
        return updateById(room);
    }

    @Transactional
    public boolean endRoom(Long roomId, Long userId) {
        Room room = getById(roomId);
        if (room == null || !room.getCreatorId().equals(userId)) {
            return false;
        }

        room.setStatus(2);
        room.setEndTime(LocalDateTime.now());
        updateById(room);

        Map<String, Object> summary = scoreService.getScoreSummary(roomId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> memberScores = (List<Map<String, Object>>) summary.get("memberScores");
        Integer totalRounds = (Integer) summary.get("totalRounds");
        if (memberScores == null) {
            memberScores = List.of();
        }
        int rounds = totalRounds != null ? totalRounds : 0;
        LocalDateTime ended = room.getEndTime();
        LocalDateTime started = room.getStartTime();

        for (Map<String, Object> ms : memberScores) {
            Long uid = ((Number) ms.get("userId")).longValue();
            Integer fs = (Integer) ms.get("finalScore");
            int finalScore = fs != null ? fs : 0;
            boolean winner = finalScore > 0;
            userService.accumulateGameResult(uid, finalScore, winner);

            UserGameRecord rec = new UserGameRecord();
            rec.setUserId(uid);
            rec.setRoomId(roomId);
            rec.setGameType(room.getGameType());
            rec.setVenueName(room.getVenueName());
            rec.setRounds(rounds);
            rec.setFinalScore(finalScore);
            rec.setIsWinner(winner ? 1 : 0);
            rec.setStartedAt(started);
            rec.setEndedAt(ended);
            rec.setCreatedAt(LocalDateTime.now());
            userGameRecordMapper.insert(rec);

            RoomMember rm = roomMemberMapper.selectByRoomAndUser(roomId, uid);
            if (rm != null) {
                rm.setFinalScore(finalScore);
                roomMemberMapper.updateById(rm);
            }
        }

        Map<String, Object> endedMsg = new HashMap<>();
        endedMsg.put("roomId", roomId);
        roomWebSocketHandler.broadcast(roomId, "room_ended", endedMsg);
        return true;
    }

    @Transactional
    public String leaveRoom(Long roomId, Long userId) {
        Room room = getById(roomId);
        if (room == null) {
            return "NOT_FOUND";
        }
        if (room.getCreatorId().equals(userId)) {
            return "HOST_CANNOT_LEAVE";
        }
        if (room.getStatus() != null && room.getStatus() == 2) {
            return "ENDED";
        }
        RoomMember m = roomMemberMapper.selectByRoomAndUser(roomId, userId);
        if (m == null || m.getStatus() == null || m.getStatus() != 1) {
            return "NOT_MEMBER";
        }
        m.setStatus(3);
        roomMemberMapper.updateById(m);
        int count = roomMemberMapper.countActiveMembers(roomId);
        room.setCurrentPlayers(count);
        updateById(room);
        Map<String, Object> data = new HashMap<>();
        data.put("userId", userId);
        roomWebSocketHandler.broadcast(roomId, "member_left", data);
        return null;
    }

    @Transactional
    public String kickMember(Long roomId, Long operatorId, Long targetUserId) {
        Room room = getById(roomId);
        if (room == null) {
            return "NOT_FOUND";
        }
        if (!room.getCreatorId().equals(operatorId)) {
            return "NOT_OWNER";
        }
        if (operatorId.equals(targetUserId)) {
            return "BAD_TARGET";
        }
        if (room.getStatus() != null && room.getStatus() == 2) {
            return "ENDED";
        }
        RoomMember m = roomMemberMapper.selectByRoomAndUser(roomId, targetUserId);
        if (m == null || m.getStatus() == null || m.getStatus() != 1) {
            return "NOT_MEMBER";
        }
        m.setStatus(3);
        roomMemberMapper.updateById(m);
        int count = roomMemberMapper.countActiveMembers(roomId);
        room.setCurrentPlayers(count);
        updateById(room);

        Map<String, Object> kickData = new HashMap<>();
        kickData.put("roomId", roomId);
        roomWebSocketHandler.sendToUser(roomId, targetUserId, "kicked", kickData);

        Map<String, Object> bc = new HashMap<>();
        bc.put("targetUserId", targetUserId);
        roomWebSocketHandler.broadcast(roomId, "member_kicked", bc);
        roomWebSocketHandler.removeUserFromRoomSessions(roomId, targetUserId);
        return null;
    }

    @Transactional
    public String transferRoom(Long roomId, Long operatorId, Long newOwnerId) {
        Room room = getById(roomId);
        if (room == null) {
            return "NOT_FOUND";
        }
        if (!room.getCreatorId().equals(operatorId)) {
            return "NOT_OWNER";
        }
        if (operatorId.equals(newOwnerId)) {
            return "BAD_TARGET";
        }
        if (room.getStatus() != null && room.getStatus() == 2) {
            return "ENDED";
        }
        RoomMember oldOwner = roomMemberMapper.selectByRoomAndUser(roomId, operatorId);
        RoomMember newOwner = roomMemberMapper.selectByRoomAndUser(roomId, newOwnerId);
        if (oldOwner == null || newOwner == null
                || oldOwner.getStatus() == null || newOwner.getStatus() == null
                || oldOwner.getStatus() != 1 || newOwner.getStatus() != 1) {
            return "NOT_MEMBER";
        }
        oldOwner.setRole(0);
        newOwner.setRole(1);
        roomMemberMapper.updateById(oldOwner);
        roomMemberMapper.updateById(newOwner);
        room.setCreatorId(newOwnerId);
        updateById(room);
        Map<String, Object> data = new HashMap<>();
        data.put("newOwnerId", newOwnerId);
        roomWebSocketHandler.broadcast(roomId, "room_transfer", data);
        return null;
    }

    public List<RoomMember> getRoomMembers(Long roomId) {
        return roomMemberMapper.selectActiveMembers(roomId);
    }

    public boolean isActiveMember(Long roomId, Long userId) {
        RoomMember m = roomMemberMapper.selectByRoomAndUser(roomId, userId);
        return m != null && m.getStatus() != null && m.getStatus() == 1;
    }

    private String generateRoomNo() {
        Random random = new Random();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            sb.append(random.nextInt(10));
        }
        return sb.toString();
    }
}
