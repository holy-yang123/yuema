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
    
    @Select("SELECT * FROM rooms WHERE status = #{status} AND deleted = 0 ORDER BY created_at DESC")
    List<Room> selectByStatus(@Param("status") Integer status);
    
    @Select("SELECT * FROM rooms WHERE creator_id = #{creatorId} AND deleted = 0 ORDER BY created_at DESC")
    List<Room> selectByCreatorId(@Param("creatorId") Long creatorId);
}
