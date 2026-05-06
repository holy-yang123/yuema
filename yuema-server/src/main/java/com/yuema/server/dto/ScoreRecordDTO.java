package com.yuema.server.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class ScoreRecordDTO {
    
    @NotNull(message = "牌局ID不能为空")
    private Long roomId;
    
    @NotNull(message = "局数不能为空")
    private Integer roundNo;
    
    private String scoreType;
    
    private String remark;
    
    private List<PlayerScoreDTO> playerScores;
    
    @Data
    public static class PlayerScoreDTO {
        @NotNull(message = "用户ID不能为空")
        private Long userId;
        
        @NotNull(message = "分数变化不能为空")
        private Integer scoreChange;
    }
}
