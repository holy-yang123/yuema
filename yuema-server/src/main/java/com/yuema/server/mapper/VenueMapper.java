package com.yuema.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.yuema.server.entity.Venue;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface VenueMapper extends BaseMapper<Venue> {
    
    @Select("SELECT * FROM venues WHERE status = 1 AND deleted = 0 ORDER BY rating DESC")
    List<Venue> selectActiveVenues();
    
    @Select("SELECT * FROM venues WHERE status = 1 AND deleted = 0 " +
            "ORDER BY (POWER(longitude - #{lng}, 2) + POWER(latitude - #{lat}, 2)) ASC " +
            "LIMIT #{limit}")
    List<Venue> selectNearbyVenues(@Param("lng") Double lng, @Param("lat") Double lat, @Param("limit") Integer limit);
}
