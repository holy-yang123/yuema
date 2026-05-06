package com.yuema.server.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("score_records")
public class ScoreRecord {
    
    @TableId(type = IdType.AUTO)
    private Long id;
    
    @TableField("room_id")
    private Long roomId;
    
    @TableField("round_no")
    private Integer roundNo;
    
    @TableField("user_id")
    private Long userId;
    
    @TableField("score_change")
    private Integer scoreChange;
    
    @TableField("score_type")
    private String scoreType;
    
    @TableField("recorder_id")
    private Long recorderId;
    
    private Integer status;
    
    private String remark;
    
    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    
    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
