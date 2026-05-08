package com.yuema.server.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class JoinRoomDTO {

    @NotBlank(message = "房间号不能为空")
    private String roomNo;
}
