package com.yuema.server.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.yuema.server.dto.CreateRoomDTO;
import com.yuema.server.entity.Room;
import com.yuema.server.entity.RoomMember;
import com.yuema.server.entity.Venue;
import com.yuema.server.mapper.RoomMapper;
import com.yuema.server.mapper.RoomMemberMapper;
import com.yuema.server.mapper.VenueMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;

@Service
public class RoomService extends ServiceImpl<RoomMapper, Room> {

    @Autowired
    private RoomMemberMapper roomMemberMapper;

    @Autowired
    private VenueMapper venueMapper;

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
        return updateById(room);
    }

    public List<RoomMember> getRoomMembers(Long roomId) {
        return roomMemberMapper.selectActiveMembers(roomId);
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
