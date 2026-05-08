package com.yuema.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.yuema.server.entity.ScoreRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface ScoreRecordMapper extends BaseMapper<ScoreRecord> {
    
    @Select("SELECT * FROM score_records WHERE room_id = #{roomId} AND status = 1 ORDER BY round_no, id")
    List<ScoreRecord> selectByRoomId(@Param("roomId") Long roomId);
    
    @Select("SELECT * FROM score_records WHERE room_id = #{roomId} AND round_no = #{roundNo} AND status = 1")
    List<ScoreRecord> selectByRoomAndRound(@Param("roomId") Long roomId, @Param("roundNo") Integer roundNo);
    
    @Select("SELECT MAX(round_no) FROM score_records WHERE room_id = #{roomId} AND status = 1")
    Integer selectMaxRoundNo(@Param("roomId") Long roomId);
    
    @Select("SELECT user_id, SUM(score_change) as total_score FROM score_records " +
            "WHERE room_id = #{roomId} AND status = 1 GROUP BY user_id")
    List<Map<String, Object>> selectScoreSummary(@Param("roomId") Long roomId);

    @org.apache.ibatis.annotations.Update("UPDATE score_records SET status = 2, updated_at = NOW() " +
            "WHERE room_id = #{roomId} AND round_no = #{roundNo} AND status = 1")
    int invalidateRoundRecords(@Param("roomId") Long roomId, @Param("roundNo") Integer roundNo);
}
