package com.yuema.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.yuema.server.entity.RoomMember;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface RoomMemberMapper extends BaseMapper<RoomMember> {
    
    @Select("SELECT * FROM room_members WHERE room_id = #{roomId} AND status = 1")
    List<RoomMember> selectActiveMembers(@Param("roomId") Long roomId);
    
    @Select("SELECT COUNT(*) FROM room_members WHERE room_id = #{roomId} AND status = 1")
    Integer countActiveMembers(@Param("roomId") Long roomId);
    
    @Select("SELECT * FROM room_members WHERE room_id = #{roomId} AND user_id = #{userId}")
    RoomMember selectByRoomAndUser(@Param("roomId") Long roomId, @Param("userId") Long userId);
}
