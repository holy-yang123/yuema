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

    /** 计划开始时间窗口（卡片展示；与实际开局 start_time 无关） */
    private LocalDateTime startWindowBegin;
    private LocalDateTime startWindowEnd;
    /** 预计牌局时长（分钟）；前端按小时选档时为整小时×60，合法区间 1–1440 */
    private Integer durationMinutes;

    private Integer baseScore;
    private Integer taiFee;
    private String remark;

    /** 按玩法分桶的规则对象（布尔键 + customLines），服务端序列化写入 game_rules */
    private JsonNode gameRules;
}
