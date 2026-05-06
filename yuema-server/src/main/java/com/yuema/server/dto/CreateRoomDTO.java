package com.yuema.server.dto;

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
}
