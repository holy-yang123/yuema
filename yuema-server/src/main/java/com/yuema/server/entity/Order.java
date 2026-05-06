package com.yuema.server.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@TableName("orders")
public class Order {
    
    @TableId(type = IdType.AUTO)
    private Long id;
    
    @TableField("order_no")
    private String orderNo;
    
    @TableField("user_id")
    private Long userId;
    
    @TableField("venue_id")
    private Long venueId;
    
    @TableField("venue_room_id")
    private Long venueRoomId;
    
    @TableField("room_id")
    private Long roomId;
    
    @TableField("booking_date")
    private LocalDate bookingDate;
    
    @TableField("start_time")
    private LocalTime startTime;
    
    @TableField("end_time")
    private LocalTime endTime;
    
    @TableField("duration_hours")
    private Integer durationHours;
    
    @TableField("total_amount")
    private Integer totalAmount;
    
    @TableField("pay_amount")
    private Integer payAmount;
    
    private Integer status;
    
    @TableField("pay_time")
    private LocalDateTime payTime;
    
    @TableField("pay_type")
    private String payType;
    
    @TableField("pay_transaction_id")
    private String payTransactionId;
    
    private String remark;
    
    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    
    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
