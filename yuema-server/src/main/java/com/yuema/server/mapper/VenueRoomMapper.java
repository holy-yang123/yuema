package com.yuema.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.yuema.server.entity.VenueRoom;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface VenueRoomMapper extends BaseMapper<VenueRoom> {
    
    @Select("SELECT * FROM venue_rooms WHERE venue_id = #{venueId} AND status = 1")
    List<VenueRoom> selectByVenueId(@Param("venueId") Long venueId);
}
