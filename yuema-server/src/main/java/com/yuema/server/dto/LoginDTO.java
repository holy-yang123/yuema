package com.yuema.server.dto;

import lombok.Data;

@Data
public class LoginDTO {
    private String openid;
    private String nickname;
    private String avatarUrl;
}
