package com.yuema.server.websocket;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import lombok.extern.slf4j.Slf4j;
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

    // roomId -> sessions
    private static final Map<Long, CopyOnWriteArrayList<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();
    
    // sessionId -> roomId
    private static final Map<String, Long> sessionRoomMap = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info("WebSocket连接建立: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        log.info("收到消息: {}", payload);

        try {
            JSONObject json = JSON.parseObject(payload);
            String type = json.getString("type");

            switch (type) {
                case "join":
                    handleJoin(session, json);
                    break;
                case "leave":
                    handleLeave(session);
                    break;
                case "chat":
                    handleChat(session, json);
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
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        log.info("WebSocket连接关闭: {}", session.getId());
        handleLeave(session);
    }

    private void handleJoin(WebSocketSession session, JSONObject json) {
        Long roomId = json.getLong("roomId");
        Long userId = json.getLong("userId");

        if (roomId == null || userId == null) {
            sendMessage(session, createMessage("error", "参数错误"));
            return;
        }

        // 将session加入房间
        roomSessions.computeIfAbsent(roomId, k -> new CopyOnWriteArrayList<>()).add(session);
        sessionRoomMap.put(session.getId(), roomId);

        // 通知房间内其他用户
        JSONObject msg = new JSONObject();
        msg.put("type", "user_join");
        msg.put("userId", userId);
        msg.put("message", "用户 " + userId + " 加入房间");
        broadcastToRoom(roomId, msg, session);

        sendMessage(session, createMessage("success", "加入房间成功"));
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

    private void handleChat(WebSocketSession session, JSONObject json) {
        Long roomId = sessionRoomMap.get(session.getId());
        if (roomId == null) {
            sendMessage(session, createMessage("error", "未加入房间"));
            return;
        }

        String content = json.getString("content");
        Long userId = json.getLong("userId");

        JSONObject msg = new JSONObject();
        msg.put("type", "chat");
        msg.put("userId", userId);
        msg.put("content", content);
        msg.put("timestamp", System.currentTimeMillis());

        broadcastToRoom(roomId, msg, null);
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

        broadcastToRoom(roomId, msg, null);
    }

    private void broadcastToRoom(Long roomId, JSONObject message, WebSocketSession exclude) {
        CopyOnWriteArrayList<WebSocketSession> sessions = roomSessions.get(roomId);
        if (sessions == null) return;

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

    // 外部调用：向房间广播消息
    public void broadcast(Long roomId, String type, Object data) {
        JSONObject msg = new JSONObject();
        msg.put("type", type);
        msg.put("data", data);
        msg.put("timestamp", System.currentTimeMillis());
        broadcastToRoom(roomId, msg, null);
    }
}
