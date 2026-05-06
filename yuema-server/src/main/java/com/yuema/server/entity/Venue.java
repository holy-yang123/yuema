package com.yuema.server.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("venues")
public class Venue {
    
    @TableId(type = IdType.AUTO)
    private Long id;
    
    private String name;
    
    private String address;
    
    private BigDecimal longitude;
    
    private BigDecimal latitude;
    
    private String phone;
    
    @TableField("business_hours")
    private String businessHours;
    
    private BigDecimal rating;
    
    @TableField("image_urls")
    private String imageUrls;
    
    private String facilities;
    
    @TableField("min_price")
    private Integer minPrice;
    
    @TableField("max_price")
    private Integer maxPrice;
    
    private Integer status;
    
    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    
    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
    
    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
