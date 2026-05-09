package com.yuema.server.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
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

    @Autowired
    private ObjectMapper objectMapper;

    @Transactional
    public Room createRoom(Long creatorId, CreateRoomDTO dto) {
        Room room = new Room();
        room.setRoomNo(generateRoomNo());
        room.setCreatorId(creatorId);
        room.setStatus(0);
        room.setGameType(dto.getGameType());
        // 避免 max_players 为 null 时 join 比较拆箱 NPE（HTTP 500）
        room.setMaxPlayers(dto.getMaxPlayers() != null ? dto.getMaxPlayers() : 4);
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
        // 玩法细则：DTO 为 JsonNode，落库为 JSON 字符串；含 customLines 条数与长度裁剪
        if (dto.getGameRules() != null) {
            room.setGameRules(normalizeGameRulesJson(dto.getGameRules()));
        }

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

    /**
     * 房主在等待中状态下修改牌局信息（玩法、人数上限、场地/坐标等）
     */
    @Transactional
    public String updateRoom(Long roomId, Long operatorId, CreateRoomDTO dto) {
        Room room = getById(roomId);
        if (room == null) {
            return "NOT_FOUND";
        }
        if (!room.getCreatorId().equals(operatorId)) {
            return "NOT_OWNER";
        }
        if (room.getStatus() == null || room.getStatus() != 0) {
            return "NOT_EDITABLE";
        }

        int count = roomMemberMapper.countActiveMembers(roomId);
        if (dto.getMaxPlayers() != null && dto.getMaxPlayers() < count) {
            return "MAX_TOO_SMALL";
        }

        room.setGameType(dto.getGameType());
        if (dto.getMaxPlayers() != null) {
            room.setMaxPlayers(dto.getMaxPlayers());
        }
        room.setVenueId(dto.getVenueId());
        room.setLongitude(dto.getLongitude());
        room.setLatitude(dto.getLatitude());

        if (dto.getVenueId() != null) {
            Venue venue = venueMapper.selectById(dto.getVenueId());
            if (venue != null) {
                room.setVenueName(venue.getName());
                if (room.getLongitude() == null) {
                    room.setLongitude(venue.getLongitude());
                }
                if (room.getLatitude() == null) {
                    room.setLatitude(venue.getLatitude());
                }
            }
        } else {
            room.setVenueName(null);
        }

        // 小程序请求体未传的字段勿覆盖为 null
        if (dto.getStartTime() != null) {
            room.setStartTime(dto.getStartTime());
        }
        if (dto.getBaseScore() != null) {
            room.setBaseScore(dto.getBaseScore());
        }
        if (dto.getTaiFee() != null) {
            room.setTaiFee(dto.getTaiFee());
        }
        if (dto.getRemark() != null) {
            room.setRemark(dto.getRemark());
        }
        // 与 remark 一致：请求未传 gameRules 时不覆盖已有细则
        if (dto.getGameRules() != null) {
            room.setGameRules(normalizeGameRulesJson(dto.getGameRules()));
        }

        updateById(room);
        return null;
    }

    /**
     * 校验并裁剪玩法细则：每桶最多 5 条自定义、每条最多 40 字；仅保留布尔开关与 customLines。
     */
    private String normalizeGameRulesJson(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return null;
        }
        // 客户端偶发将对象二次序列化为字符串，此处展开避免落库前抛 500
        if (node.isTextual()) {
            try {
                node = objectMapper.readTree(node.asText());
            } catch (Exception e) {
                throw new IllegalArgumentException("gameRules 不是合法 JSON");
            }
        }
        if (!node.isObject()) {
            throw new IllegalArgumentException("gameRules 须为 JSON 对象");
        }
        ObjectNode out = objectMapper.createObjectNode();
        node.fields().forEachRemaining(e -> {
            String gameTypeKey = e.getKey();
            JsonNode bucket = e.getValue();
            if (!bucket.isObject()) {
                return;
            }
            ObjectNode bucketOut = objectMapper.createObjectNode();
            ArrayNode customArr = objectMapper.createArrayNode();
            bucket.fields().forEachRemaining(be -> {
                String k = be.getKey();
                JsonNode v = be.getValue();
                if ("customLines".equals(k)) {
                    if (v != null && v.isArray()) {
                        int n = 0;
                        for (JsonNode line : v) {
                            if (n >= 5) {
                                break;
                            }
                            String t = line.isTextual() ? line.asText().trim() : "";
                            if (!t.isEmpty()) {
                                if (t.length() > 40) {
                                    t = t.substring(0, 40);
                                }
                                customArr.add(t);
                                n++;
                            }
                        }
                    }
                } else if (v != null && v.isBoolean()) {
                    bucketOut.set(k, v);
                }
            });
            if (customArr.size() > 0) {
                bucketOut.set("customLines", customArr);
            }
            if (bucketOut.size() > 0) {
                out.set(gameTypeKey, bucketOut);
            }
        });
        try {
            return objectMapper.writeValueAsString(out);
        } catch (Exception ex) {
            throw new IllegalArgumentException("玩法细则序列化失败");
        }
    }

    /**
     * 房主删除等待中的牌局：清理成员记录并逻辑删除房间
     */
    @Transactional
    public String deleteRoom(Long roomId, Long operatorId) {
        Room room = getById(roomId);
        if (room == null) {
            return "NOT_FOUND";
        }
        if (!room.getCreatorId().equals(operatorId)) {
            return "NOT_OWNER";
        }
        if (room.getStatus() == null || room.getStatus() != 0) {
            return "NOT_DELETABLE";
        }

        roomMemberMapper.delete(new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));
        removeById(roomId);
        return null;
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

        // 检查人数（COUNT 与上限均做空值防护，避免 Integer 拆箱 NPE 导致接口 HTTP 500）
        Integer countBoxed = roomMemberMapper.countActiveMembers(roomId);
        int count = countBoxed != null ? countBoxed : 0;
        Integer maxBoxed = room.getMaxPlayers();
        int maxPlayers = maxBoxed != null && maxBoxed > 0 ? maxBoxed : 4;
        if (count >= maxPlayers) {
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
