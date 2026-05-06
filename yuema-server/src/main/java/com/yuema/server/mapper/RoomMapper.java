package com.yuema.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.yuema.server.entity.Room;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface RoomMapper extends BaseMapper<Room> {
    
    @Select("SELECT * FROM rooms WHERE room_no = #{roomNo} AND deleted = 0")
    Room selectByRoomNo(@Param("roomNo") String roomNo);
    
    @Select("SELECT r.* FROM rooms r " +
            "LEFT JOIN venues v ON r.venue_id = v.id " +
            "WHERE r.status = #{status} AND r.deleted = 0 " +
            "ORDER BY (POWER(COALESCE(r.longitude, v.longitude) - #{lng}, 2) + " +
            "POWER(COALESCE(r.latitude, v.latitude) - #{lat}, 2)) ASC")
    List<Room> selectNearbyRooms(@Param("status") Integer status, @Param("lng") Double lng, @Param("lat") Double lat);

    @Select("SELECT * FROM rooms WHERE creator_id = #{creatorId} AND deleted = 0 ORDER BY created_at DESC")
    List<Room> selectByCreatorId(@Param("creatorId") Long creatorId);
}
