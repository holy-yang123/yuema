package com.yuema.server.dto;

import lombok.Data;

@Data
public class LoginDTO {
    /**
     * 小程序 wx.login 返回的 code，服务端用于换取 openid。
     */
    private String code;
    private String nickname;
    private String avatarUrl;
}
