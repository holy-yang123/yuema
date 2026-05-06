package com.yuema.server.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("venue_rooms")
public class VenueRoom {
    
    @TableId(type = IdType.AUTO)
    private Long id;
    
    @TableField("venue_id")
    private Long venueId;
    
    private String name;
    
    @TableField("room_type")
    private String roomType;
    
    private Integer capacity;
    
    @TableField("price_per_hour")
    private Integer pricePerHour;
    
    @TableField("image_urls")
    private String imageUrls;
    
    private String facilities;
    
    private Integer status;
    
    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    
    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
