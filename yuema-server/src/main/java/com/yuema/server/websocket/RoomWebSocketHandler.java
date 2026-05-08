package com.yuema.server.websocket;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import com.yuema.server.config.JwtHandshakeInterceptor;
import com.yuema.server.entity.ChatMessage;
import com.yuema.server.entity.User;
import com.yuema.server.service.ChatService;
import com.yuema.server.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Component
public class RoomWebSocketHandler extends TextWebSocketHandler {

    private static final Map<Long, CopyOnWriteArrayList<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();
    private static final Map<String, Long> sessionRoomMap = new ConcurrentHashMap<>();

    @Autowired
    private ChatService chatService;

    @Autowired
    private UserService userService;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("WebSocket连接建立: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        log.debug("收到消息: {}", payload);

        Long authUserId = (Long) session.getAttributes().get(JwtHandshakeInterceptor.ATTR_USER_ID);
        if (authUserId == null) {
            sendMessage(session, createMessage("error", "未授权"));
            return;
        }

        try {
            JSONObject json = JSON.parseObject(payload);
            String type = json.getString("type");

            switch (type) {
                case "join":
                    handleJoin(session, json, authUserId);
                    break;
                case "leave":
                    handleLeave(session);
                    break;
                case "chat":
                    handleChat(session, json, authUserId);
                    break;
                case "score_update":
                    handleScoreUpdate(session, json);
                    break;
                default:
                    sendMessage(session, createMessage("error", "未知消息类型"));
            }
        } catch (Exception e) {
            log.error("处理消息失败", e);
            sendMessage(session, createMessage("error", "消息处理失败"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.info("WebSocket连接关闭: {}", session.getId());
        handleLeave(session);
    }

    private void handleJoin(WebSocketSession session, JSONObject json, Long userId) {
        Long roomId = json.getLong("roomId");
        if (roomId == null) {
            sendMessage(session, createMessage("error", "参数错误"));
            return;
        }

        if (!chatService.isActiveMember(roomId, userId)) {
            sendMessage(session, createMessage("error", "无权进入该牌局"));
            return;
        }

        roomSessions.computeIfAbsent(roomId, k -> new CopyOnWriteArrayList<>()).add(session);
        sessionRoomMap.put(session.getId(), roomId);

        User user = userService.getById(userId);
        String nick = user != null && user.getNickname() != null ? user.getNickname() : ("用户" + userId);
        ChatMessage saved = chatService.saveMessage(roomId, userId, "system", nick + " 进入了房间");

        JSONObject msg = new JSONObject();
        msg.put("type", "user_join");
        msg.put("userId", userId);
        msg.put("nickname", nick);
        msg.put("message", nick + " 进入房间");
        broadcastToRoom(roomId, msg, session);

        JSONObject ack = new JSONObject();
        ack.put("type", "success");
        ack.put("content", "加入房间成功");
        ack.put("chatMessage", toChatJson(saved, nick));
        ack.put("timestamp", System.currentTimeMillis());
        sendMessage(session, ack.toJSONString());
    }

    private void handleLeave(WebSocketSession session) {
        Long roomId = sessionRoomMap.get(session.getId());
        if (roomId != null) {
            CopyOnWriteArrayList<WebSocketSession> sessions = roomSessions.get(roomId);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    roomSessions.remove(roomId);
                }
            }
            sessionRoomMap.remove(session.getId());
        }
    }

    private void handleChat(WebSocketSession session, JSONObject json, Long userId) {
        Long roomId = sessionRoomMap.get(session.getId());
        if (roomId == null) {
            sendMessage(session, createMessage("error", "未加入房间"));
            return;
        }

        String content = json.getString("content");
        if (content == null || content.trim().isEmpty()) {
            sendMessage(session, createMessage("error", "内容不能为空"));
            return;
        }
        if (content.length() > 500) {
            sendMessage(session, createMessage("error", "内容过长"));
            return;
        }

        if (!chatService.isActiveMember(roomId, userId)) {
            sendMessage(session, createMessage("error", "已不在牌局中"));
            return;
        }

        ChatMessage saved = chatService.saveMessage(roomId, userId, "text", content.trim());
        User user = userService.getById(userId);
        String nick = user != null && user.getNickname() != null ? user.getNickname() : ("用户" + userId);

        JSONObject msg = new JSONObject();
        msg.put("type", "chat");
        msg.put("data", toChatJson(saved, nick));
        msg.put("timestamp", System.currentTimeMillis());

        broadcastToRoom(roomId, msg, null);
    }

    private JSONObject toChatJson(ChatMessage m, String nickname) {
        JSONObject o = new JSONObject();
        o.put("id", m.getId());
        o.put("roomId", m.getRoomId());
        o.put("userId", m.getUserId());
        o.put("nickname", nickname);
        o.put("msgType", m.getMsgType());
        o.put("content", m.getContent());
        o.put("createdAt", m.getCreatedAt() != null ? m.getCreatedAt().toString() : "");
        return o;
    }

    private void handleScoreUpdate(WebSocketSession session, JSONObject json) {
        Long roomId = sessionRoomMap.get(session.getId());
        if (roomId == null) {
            sendMessage(session, createMessage("error", "未加入房间"));
            return;
        }

        JSONObject msg = new JSONObject();
        msg.put("type", "score_update");
        msg.put("data", json.get("data"));
        msg.put("timestamp", System.currentTimeMillis());

        broadcastToRoom(roomId, msg, null);
    }

    private void broadcastToRoom(Long roomId, JSONObject message, WebSocketSession exclude) {
        CopyOnWriteArrayList<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions == null) {
            return;
        }

        String msgStr = message.toJSONString();
        for (WebSocketSession session : sessions) {
            if (exclude == null || !session.getId().equals(exclude.getId())) {
                sendMessage(session, msgStr);
            }
        }
    }

    private void sendMessage(WebSocketSession session, String message) {
        try {
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(message));
            }
        } catch (IOException e) {
            log.error("发送消息失败", e);
        }
    }

    private String createMessage(String type, String content) {
        JSONObject json = new JSONObject();
        json.put("type", type);
        json.put("content", content);
        json.put("timestamp", System.currentTimeMillis());
        return json.toJSONString();
    }

    /**
     * 供业务层向牌局内广播（计分修改、踢人等）
     */
    public void broadcast(Long roomId, String type, Object data) {
        JSONObject msg = new JSONObject();
        msg.put("type", type);
        msg.put("data", data);
        msg.put("timestamp", System.currentTimeMillis());
        broadcastToRoom(roomId, msg, null);
    }

    /**
     * 仅向某一用户的连接发送（用于被踢下线提示）
     */
    public void sendToUser(Long roomId, Long userId, String type, Object data) {
        JSONObject msg = new JSONObject();
        msg.put("type", type);
        msg.put("data", data);
        msg.put("timestamp", System.currentTimeMillis());
        CopyOnWriteArrayList<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions == null) {
            return;
        }
        String msgStr = msg.toJSONString();
        for (WebSocketSession session : sessions) {
            Long uid = (Long) session.getAttributes().get(JwtHandshakeInterceptor.ATTR_USER_ID);
            if (userId != null && userId.equals(uid)) {
                sendMessage(session, msgStr);
                break;
            }
        }
    }

    /**
     * 踢人时移除该用户在本房间的所有 session
     */
    public void removeUserFromRoomSessions(Long roomId, Long userId) {
        CopyOnWriteArrayList<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions == null) {
            return;
        }
        for (WebSocketSession session : new CopyOnWriteArrayList<>(sessions)) {
            Long uid = (Long) session.getAttributes().get(JwtHandshakeInterceptor.ATTR_USER_ID);
            if (userId != null && userId.equals(uid)) {
                sessions.remove(session);
                sessionRoomMap.remove(session.getId());
                try {
                    session.close(CloseStatus.NORMAL);
                } catch (IOException ignored) {
                }
            }
        }
        if (sessions.isEmpty()) {
            roomSessions.remove(roomId);
        }
    }
}
