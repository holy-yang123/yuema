package com.yuema.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.yuema.server.entity.ScoreModifyRequest;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ScoreModifyRequestMapper extends BaseMapper<ScoreModifyRequest> {

    @Select("SELECT * FROM score_modify_requests WHERE room_id = #{roomId} AND status = 0 ORDER BY id DESC LIMIT 1")
    ScoreModifyRequest selectLatestPending(@Param("roomId") Long roomId);
}
