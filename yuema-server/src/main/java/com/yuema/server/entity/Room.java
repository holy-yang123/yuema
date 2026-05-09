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

    /** 计划开始时间窗口起点（与实际开局 start_time 分离） */
    @TableField("start_window_begin")
    private LocalDateTime startWindowBegin;

    /** 计划开始时间窗口终点 */
    @TableField("start_window_end")
    private LocalDateTime startWindowEnd;

    /** 预计牌局时长（分钟）；小程序按小时选档时为整小时×60 */
    @TableField("duration_minutes")
    private Integer durationMinutes;
    
    @TableField("base_score")
    private Integer baseScore;
    
    @TableField("tai_fee")
    private Integer taiFee;
    
    private BigDecimal longitude;
    
    private BigDecimal latitude;
    
    private String remark;

    /** 玩法细则 JSON（按 game_type 分桶），见 CreateRoomDTO.gameRules */
    @TableField("game_rules")
    private String gameRules;
    
    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    
    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
    
    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
