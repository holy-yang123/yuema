package com.yuema.server.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.yuema.server.entity.ChatMessage;
import com.yuema.server.entity.RoomMember;
import com.yuema.server.entity.User;
import com.yuema.server.mapper.ChatMessageMapper;
import com.yuema.server.mapper.RoomMemberMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ChatService extends ServiceImpl<ChatMessageMapper, ChatMessage> {

    @Autowired
    private RoomMemberMapper roomMemberMapper;

    @Autowired
    private UserService userService;

    public boolean isActiveMember(Long roomId, Long userId) {
        RoomMember m = roomMemberMapper.selectByRoomAndUser(roomId, userId);
        return m != null && m.getStatus() != null && m.getStatus() == 1;
    }

    public ChatMessage saveMessage(Long roomId, Long userId, String msgType, String content) {
        ChatMessage msg = new ChatMessage();
        msg.setRoomId(roomId);
        msg.setUserId(userId);
        msg.setMsgType(msgType != null ? msgType : "text");
        msg.setContent(content);
        msg.setCreatedAt(LocalDateTime.now());
        save(msg);
        return msg;
    }

    public List<Map<String, Object>> listMessages(Long roomId, Long userId, Long beforeId, int limit) {
        if (!isActiveMember(roomId, userId)) {
            return Collections.emptyList();
        }
        if (limit <= 0 || limit > 100) {
            limit = 50;
        }
        List<ChatMessage> raw;
        if (beforeId == null || beforeId <= 0) {
            raw = baseMapper.selectLatest(roomId, limit);
        } else {
            raw = baseMapper.selectBeforeId(roomId, beforeId, limit);
        }
        Collections.reverse(raw);
        List<Map<String, Object>> out = new ArrayList<>();
        for (ChatMessage m : raw) {
            Map<String, Object> row = new HashMap<>();
            row.put("id", m.getId());
            row.put("roomId", m.getRoomId());
            row.put("userId", m.getUserId());
            row.put("msgType", m.getMsgType());
            row.put("content", m.getContent());
            row.put("createdAt", m.getCreatedAt());
            String nickname = "";
            if (m.getUserId() != null && m.getUserId() > 0) {
                User u = userService.getById(m.getUserId());
                nickname = u != null && u.getNickname() != null ? u.getNickname() : "";
            } else {
                nickname = "系统";
            }
            row.put("nickname", nickname);
            out.add(row);
        }
        return out;
    }
}
