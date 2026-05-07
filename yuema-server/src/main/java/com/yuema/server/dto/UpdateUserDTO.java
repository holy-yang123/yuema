package com.yuema.server.dto;

import lombok.Data;

@Data
public class UpdateUserDTO {
    private String nickname;
    private String avatarUrl;
    private String phone;
}
