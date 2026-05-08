package com.yuema.server.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("score_modify_requests")
public class ScoreModifyRequest {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("room_id")
    private Long roomId;

    @TableField("round_no")
    private Integer roundNo;

    @TableField("requester_id")
    private Long requesterId;

    @TableField("new_payload")
    private String newPayload;

    @TableField("new_score_type")
    private String newScoreType;

    @TableField("new_remark")
    private String newRemark;

    private Integer status;

    @TableField("created_at")
    private LocalDateTime createdAt;
}
