package com.yuema.server.service;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import com.yuema.server.config.WxMiniAppProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

@Service
public class WxMiniAppService {

    private static final String MOCK_OPENID = "mock_wx_openid";

    @Autowired
    private WxMiniAppProperties wxMiniAppProperties;

    @Autowired
    private RestTemplate restTemplate;

    /**
     * 使用 login code 换取稳定 openid。
     */
    public String codeToOpenid(String code) {
        if (code == null || code.isEmpty()) {
            throw new IllegalArgumentException("缺少登录 code");
        }
        if (wxMiniAppProperties.isMockEnabled()) {
            return MOCK_OPENID;
        }
        String appid = wxMiniAppProperties.getAppid();
        String secret = wxMiniAppProperties.getSecret();
        if (appid == null || appid.isEmpty() || secret == null || secret.isEmpty()
                || "your-app-id".equals(appid) || "your-app-secret".equals(secret)) {
            throw new IllegalStateException("未配置有效的 wx.miniapp.appid / secret，请配置或在开发环境设置 wx.miniapp.mock-enabled=true");
        }

        URI uri = UriComponentsBuilder.fromHttpUrl("https://api.weixin.qq.com/sns/jscode2session")
                .queryParam("appid", appid)
                .queryParam("secret", secret)
                .queryParam("js_code", code)
                .queryParam("grant_type", "authorization_code")
                .build()
                .encode()
                .toUri();

        String body = restTemplate.getForObject(uri, String.class);
        if (body == null || body.isEmpty()) {
            throw new IllegalStateException("微信接口无响应");
        }
        JSONObject json = JSON.parseObject(body);
        Integer errcode = json.getInteger("errcode");
        if (errcode != null && errcode != 0) {
            String errmsg = json.getString("errmsg");
            throw new IllegalStateException(errmsg != null ? errmsg : "微信登录失败，errcode=" + errcode);
        }
        String openid = json.getString("openid");
        if (openid == null || openid.isEmpty()) {
            throw new IllegalStateException("微信未返回 openid");
        }
        return openid;
    }
}
