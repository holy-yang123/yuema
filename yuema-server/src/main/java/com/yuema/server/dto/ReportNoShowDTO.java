package com.yuema.server.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

/** 房主标记某成员本场爽约，扣减信誉分（每牌局每人仅一次）。 */
@Data
public class ReportNoShowDTO {

    @NotNull(message = "缺少 roomId")
    private Long roomId;

    @NotNull(message = "缺少 targetUserId")
    private Long targetUserId;
}
