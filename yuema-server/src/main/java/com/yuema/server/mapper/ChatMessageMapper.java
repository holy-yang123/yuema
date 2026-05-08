package com.yuema.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.yuema.server.entity.ChatMessage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ChatMessageMapper extends BaseMapper<ChatMessage> {

    @Select("SELECT * FROM chat_messages WHERE room_id = #{roomId} ORDER BY id DESC LIMIT #{limit}")
    List<ChatMessage> selectLatest(@Param("roomId") Long roomId, @Param("limit") int limit);

    @Select("SELECT * FROM chat_messages WHERE room_id = #{roomId} AND id < #{beforeId} ORDER BY id DESC LIMIT #{limit}")
    List<ChatMessage> selectBeforeId(@Param("roomId") Long roomId, @Param("beforeId") long beforeId, @Param("limit") int limit);
}
