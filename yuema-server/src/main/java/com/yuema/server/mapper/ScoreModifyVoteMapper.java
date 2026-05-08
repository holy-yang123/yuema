package com.yuema.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.yuema.server.entity.ScoreModifyVote;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ScoreModifyVoteMapper extends BaseMapper<ScoreModifyVote> {

    @Select("SELECT COUNT(*) FROM score_modify_votes WHERE request_id = #{requestId} AND vote = 1")
    int countApprovals(@Param("requestId") Long requestId);
}
