package com.yuema.server.service;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import com.yuema.server.config.WxMiniAppProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

    private volatile String cachedAccessToken;
    private volatile long tokenExpiresAtMs;
    private final Object accessTokenLock = new Object();

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

    /**
     * 获取小程序 access_token（约 2h 有效，提前 2 分钟刷新）
     */
    public String getAccessToken() {
        if (wxMiniAppProperties.isMockEnabled()) {
            return null;
        }
        String appid = wxMiniAppProperties.getAppid();
        String secret = wxMiniAppProperties.getSecret();
        if (appid == null || appid.isEmpty() || secret == null || secret.isEmpty()) {
            throw new IllegalStateException("未配置 wx.miniapp.appid / secret");
        }
        long now = System.currentTimeMillis();
        if (cachedAccessToken != null && now < tokenExpiresAtMs - 120_000L) {
            return cachedAccessToken;
        }
        synchronized (accessTokenLock) {
            if (cachedAccessToken != null && now < tokenExpiresAtMs - 120_000L) {
                return cachedAccessToken;
            }
            URI uri = UriComponentsBuilder.fromHttpUrl("https://api.weixin.qq.com/cgi-bin/token")
                    .queryParam("grant_type", "client_credential")
                    .queryParam("appid", appid)
                    .queryParam("secret", secret)
                    .build()
                    .encode()
                    .toUri();
            String body = restTemplate.getForObject(uri, String.class);
            if (body == null || body.isEmpty()) {
                throw new IllegalStateException("获取 access_token 无响应");
            }
            JSONObject json = JSON.parseObject(body);
            if (json.containsKey("errcode") && json.getIntValue("errcode") != 0) {
                throw new IllegalStateException("获取 access_token 失败: " + json.getString("errmsg"));
            }
            String token = json.getString("access_token");
            int expiresIn = json.getIntValue("expires_in");
            if (token == null || token.isEmpty()) {
                throw new IllegalStateException("access_token 为空");
            }
            cachedAccessToken = token;
            tokenExpiresAtMs = System.currentTimeMillis() + Math.max(expiresIn, 60) * 1000L;
            return token;
        }
    }

    /**
     * 调用 getUnlimited 生成小程序码 PNG 字节；失败时抛出异常（响应体可能为 JSON）
     */
    public byte[] getWxaCodeUnlimited(String scene, String page) {
        String token = getAccessToken();
        String url = "https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=" + token;
        JSONObject req = new JSONObject();
        req.put("scene", scene);
        req.put("page", page);
        req.put("check_path", false);
        req.put("width", 280);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(req.toJSONString(), headers);
        ResponseEntity<byte[]> resp = restTemplate.postForEntity(url, entity, byte[].class);
        byte[] bytes = resp.getBody();
        if (bytes == null || bytes.length == 0) {
            throw new IllegalStateException("小程序码响应为空");
        }
        if (bytes[0] == '{') {
            JSONObject err = JSON.parseObject(new String(bytes, java.nio.charset.StandardCharsets.UTF_8));
            throw new IllegalStateException("小程序码失败: " + err.getString("errmsg"));
        }
        return bytes;
    }

    /**
     * 小程序 button「手机号快速验证」返回的 code，换取用户手机号（微信官方接口，用于弱实名/安全绑定）。
     * mock 模式返回固定号，便于本地联调。
     */
    public String fetchWxPhoneNumber(String code) {
        if (code == null || code.isEmpty()) {
            throw new IllegalArgumentException("缺少手机号 code");
        }
        if (wxMiniAppProperties.isMockEnabled()) {
            return "13800138000";
        }
        String token = getAccessToken();
        String url = "https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=" + token;
        JSONObject req = new JSONObject();
        req.put("code", code);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(req.toJSONString(), headers);
        ResponseEntity<String> resp = restTemplate.postForEntity(url, entity, String.class);
        String body = resp.getBody();
        if (body == null || body.isEmpty()) {
            throw new IllegalStateException("getuserphonenumber 无响应体");
        }
        JSONObject json = JSON.parseObject(body);
        if (json.getIntValue("errcode") != 0) {
            throw new IllegalStateException(json.getString("errmsg"));
        }
        JSONObject phoneInfo = json.getJSONObject("phone_info");
        if (phoneInfo == null) {
            throw new IllegalStateException("无 phone_info");
        }
        String pure = phoneInfo.getString("purePhoneNumber");
        String country = phoneInfo.getString("countryCode");
        if (pure != null && !pure.isEmpty()) {
            if (country != null && !country.isEmpty() && !"86".equals(country)) {
                return "+" + country + pure;
            }
            return pure;
        }
        String phoneNumber = phoneInfo.getString("phoneNumber");
        if (phoneNumber == null || phoneNumber.isEmpty()) {
            throw new IllegalStateException("无手机号字段");
        }
        return phoneNumber;
    }
}
