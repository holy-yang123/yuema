package com.yuema.server.config;

import com.yuema.server.websocket.RoomWebSocketHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(roomWebSocketHandler(), "/ws/room")
                .setAllowedOrigins("*");
    }

    @Bean
    public RoomWebSocketHandler roomWebSocketHandler() {
        return new RoomWebSocketHandler();
    }
}
