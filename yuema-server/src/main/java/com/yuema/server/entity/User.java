package com.yuema.server.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("users")
public class User {
    
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 须与表字段 openid 一致；显式映射避免命名策略误判，且插入时必须写入（NOT NULL）。
     */
    @TableField(value = "openid", insertStrategy = FieldStrategy.ALWAYS)
    private String openid;
    
    private String unionid;
    
    private String nickname;
    
    @TableField("avatar_url")
    private String avatarUrl;
    
    private String phone;
    
    private Integer gender;
    
    private Integer level;
    
    private Integer score;
    
    @TableField("total_games")
    private Integer totalGames;
    
    @TableField("win_games")
    private Integer winGames;

    /** 信誉分：新用户默认 100，爽约等场景扣减，下限 0 */
    @TableField("reputation_score")
    private Integer reputationScore;

    /**
     * 可信身份核验标记：当前实现为微信「手机号快速验证」通过后置 1；
     * 后续可接人脸/身份证三要素等强实名通道，仍写此字段或扩展等级字段。
     */
    @TableField("realname_verified")
    private Integer realnameVerified;
    
    private Integer status;
    
    @TableField("last_login_time")
    private LocalDateTime lastLoginTime;
    
    @TableField(value = "created_at", fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    
    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
    
    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
