package com.yuema.server.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("rooms")
public class Room {
    
    @TableId(type = IdType.AUTO)
    private Long id;
    
    @TableField("room_no")
    private String roomNo;
    
    @TableField("creator_id")
    private Long creatorId;
    
    private Integer status;
    
    @TableField("game_type")
    private String gameType;
    
    @TableField("max_players")
    private Integer maxPlayers;
    
    @TableField("current_players")
    private Integer currentPlayers;
    
    @TableField("venue_id")
    private Long venueId;
    
    @TableField("venue_name")
    private String venueName;
    
    @TableField("start_time")
    private LocalDateTime startTime;
    
    @TableField("end_time")
    private LocalDateTime endTime;
    
    @TableField("base_score")
    private Integer baseScore;
    
    @TableField("tai_fee")
    private Integer taiFee;
    
    private BigDecimal longitude;
    
    private BigDecimal latitude;
    
    private String remark;
    
    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    
    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
    
    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
