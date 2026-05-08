package com.yuema.server.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("score_modify_votes")
public class ScoreModifyVote {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("request_id")
    private Long requestId;

    @TableField("voter_id")
    private Long voterId;

    private Integer vote;

    @TableField("voted_at")
    private LocalDateTime votedAt;
}
