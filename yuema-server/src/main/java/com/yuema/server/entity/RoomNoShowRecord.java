package com.yuema.server.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 房主对成员「爽约」认定记录；与 users.reputation_score 联动，防同一牌局重复扣分。
 */
@Data
@TableName("room_no_show_records")
public class RoomNoShowRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("room_id")
    private Long roomId;

    @TableField("target_user_id")
    private Long targetUserId;

    @TableField("reporter_id")
    private Long reporterId;

    @TableField("deducted_points")
    private Integer deductedPoints;

    @TableField("created_at")
    private LocalDateTime createdAt;
}
