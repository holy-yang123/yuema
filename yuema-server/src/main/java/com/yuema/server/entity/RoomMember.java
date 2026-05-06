package com.yuema.server.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("room_members")
public class RoomMember {
    
    @TableId(type = IdType.AUTO)
    private Long id;
    
    @TableField("room_id")
    private Long roomId;
    
    @TableField("user_id")
    private Long userId;
    
    private Integer role;
    
    private Integer status;
    
    @TableField("seat_no")
    private Integer seatNo;
    
    @TableField("final_score")
    private Integer finalScore;
    
    @TableField("joined_at")
    private LocalDateTime joinedAt;
    
    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    
    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
