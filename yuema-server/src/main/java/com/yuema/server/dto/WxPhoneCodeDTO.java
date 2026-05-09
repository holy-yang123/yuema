package com.yuema.server.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

/**
 * 小程序 button getPhoneNumber 返回的 code，用于服务端换手机号并完成弱实名标记。
 */
@Data
public class WxPhoneCodeDTO {

    @NotBlank(message = "缺少手机号动态令牌")
    private String code;
}
