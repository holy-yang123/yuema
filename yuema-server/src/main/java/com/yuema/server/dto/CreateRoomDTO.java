package com.yuema.server.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class CreateRoomDTO {
    private String gameType;
    private Integer maxPlayers;
    private Long venueId;
    private BigDecimal longitude;
    private BigDecimal latitude;
    private LocalDateTime startTime;
    private Integer baseScore;
    private Integer taiFee;
    private String remark;

    /** 按玩法分桶的规则对象（布尔键 + customLines），服务端序列化写入 game_rules */
    private JsonNode gameRules;
}
