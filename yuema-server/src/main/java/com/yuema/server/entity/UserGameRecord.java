package com.yuema.server.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("user_game_records")
public class UserGameRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("user_id")
    private Long userId;

    @TableField("room_id")
    private Long roomId;

    @TableField("game_type")
    private String gameType;

    @TableField("venue_name")
    private String venueName;

    private Integer rounds;

    @TableField("final_score")
    private Integer finalScore;

    @TableField("is_winner")
    private Integer isWinner;

    @TableField("started_at")
    private LocalDateTime startedAt;

    @TableField("ended_at")
    private LocalDateTime endedAt;

    @TableField("created_at")
    private LocalDateTime createdAt;
}
