package com.yuema.server.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "wx.miniapp")
public class WxMiniAppProperties {

    private String appid = "";

    private String secret = "";

    /**
     * 本地开发无真实 AppSecret 时启用，使用固定 mock openid（勿用于生产）。
     */
    private boolean mockEnabled = false;
}
