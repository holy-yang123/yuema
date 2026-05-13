package com.yuema.server.controller;

import com.yuema.server.dto.LoginDTO;
import com.yuema.server.dto.UpdateUserDTO;
import com.yuema.server.dto.WxPhoneCodeDTO;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.yuema.server.entity.User;
import com.yuema.server.entity.UserGameRecord;
import com.yuema.server.mapper.UserGameRecordMapper;
import com.yuema.server.service.UserService;
import com.yuema.server.service.WxMiniAppService;
import com.yuema.server.utils.JwtUtil;
import com.yuema.server.vo.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import javax.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/user")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private UserGameRecordMapper userGameRecordMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private WxMiniAppService wxMiniAppService;

    /**
     * 小程序 image 组件加载头像 URL 的域名须在公众平台配置「downloadFile 合法域名」。
     * 若为空则从当前请求推导（易被局域网 IP、反向代理误导）；部署时请填公网 HTTPS + context-path，例如 https://api.example.com/api
     */
    @Value("${yuema.public-base-url:}")
    private String publicBaseUrl;

    @PostMapping("/login")
    public Result<Map<String, Object>> login(@RequestBody LoginDTO dto) {
        String openid;
        try {
            openid = wxMiniAppService.codeToOpenid(dto.getCode());
        } catch (IllegalArgumentException e) {
            return Result.error(400, e.getMessage());
        } catch (IllegalStateException e) {
            return Result.error(400, e.getMessage());
        }

        User user = userService.getByOpenid(openid);

        boolean isMissingProfile = (user == null) || (user.getNickname() == null || user.getNickname().isEmpty());
        boolean isNoNewProfileProvided = (dto.getNickname() == null || dto.getNickname().isEmpty());

        if (isMissingProfile && isNoNewProfileProvided) {
            return Result.error(404, "NEED_PROFILE");
        }

        if (user == null) {
            user = userService.createUser(openid, dto.getNickname(), dto.getAvatarUrl());
        } else {
            if (dto.getNickname() != null && !dto.getNickname().isEmpty()) {
                user.setNickname(dto.getNickname());
                if (StringUtils.hasText(dto.getAvatarUrl())) {
                    user.setAvatarUrl(dto.getAvatarUrl());
                }
            }
            user.setLastLoginTime(LocalDateTime.now());
            userService.updateById(user);
        }

        String token = jwtUtil.generateToken(user.getId());

        Map<String, Object> data = new HashMap<>();
        data.put("token", token);
        data.put("userId", user.getId());
        data.put("nickname", user.getNickname());
        data.put("avatarUrl", user.getAvatarUrl());
        data.put("level", user.getLevel());
        // 与 GET /user/info 对齐：登录后首屏「我的」即展示手机号/战绩/信誉等，避免仅依赖后续拉取且前端 observer 未触发时长期显示「未绑定」
        data.put("phone", user.getPhone());
        data.put("totalGames", user.getTotalGames());
        data.put("winGames", user.getWinGames());
        data.put("reputationScore", user.getReputationScore());
        data.put("realnameVerified", user.getRealnameVerified());

        return Result.success(data);
    }

    @GetMapping("/info")
    public Result<User> getUserInfo(@RequestAttribute Long userId) {
        User user = userService.getById(userId);
        if (user == null) {
            return Result.error("用户不存在");
        }
        return Result.success(user);
    }

    /**
     * 微信手机号快速验证：换绑当前账号手机号并标记 realname_verified（弱实名，公安实人可后续对接同一字段或扩展）。
     */
    @PostMapping("/bind-wx-phone")
    public Result<Void> bindWxPhone(@RequestAttribute Long userId,
                                    @RequestBody @Validated WxPhoneCodeDTO dto) {
        String err = userService.bindWxPhoneNumber(userId, dto.getCode());
        if (err != null) {
            if ("NOT_FOUND".equals(err)) {
                return Result.error("用户不存在");
            }
            if ("PHONE_TAKEN".equals(err)) {
                return Result.error("该手机号已绑定其他账号");
            }
            if (err.startsWith("WX_FAIL")) {
                return Result.error("微信校验失败，请重试");
            }
            return Result.error("绑定失败");
        }
        return Result.success();
    }

    @GetMapping("/game-records")
    public Result<Page<UserGameRecord>> gameRecords(@RequestAttribute Long userId,
                                                    @RequestParam(defaultValue = "1") long current,
                                                    @RequestParam(defaultValue = "20") long size) {
        Page<UserGameRecord> page = new Page<>(current, size);
        userGameRecordMapper.selectPage(page, Wrappers.<UserGameRecord>lambdaQuery()
                .eq(UserGameRecord::getUserId, userId)
                .orderByDesc(UserGameRecord::getEndedAt));
        return Result.success(page);
    }

    @GetMapping("/stats")
    public Result<Map<String, Object>> stats(@RequestAttribute Long userId) {
        User user = userService.getById(userId);
        if (user == null) {
            return Result.error("用户不存在");
        }
        int tg = user.getTotalGames() == null ? 0 : user.getTotalGames();
        int wg = user.getWinGames() == null ? 0 : user.getWinGames();
        int sc = user.getScore() == null ? 0 : user.getScore();
        Map<String, Object> m = new HashMap<>();
        m.put("totalGames", tg);
        m.put("winGames", wg);
        m.put("score", sc);
        m.put("winRate", tg > 0 ? Math.round((wg * 100.0) / tg) : 0);
        return Result.success(m);
    }

    @PutMapping("/info")
    public Result<Void> updateUserInfo(@RequestAttribute Long userId, @RequestBody UpdateUserDTO dto) {
        User user = userService.getById(userId);
        if (user == null) {
            return Result.error("用户不存在");
        }

        if (dto == null) {
            return Result.success();
        }
        if (StringUtils.hasText(dto.getNickname())) {
            user.setNickname(dto.getNickname());
        }
        if (dto.getAvatarUrl() != null) {
            user.setAvatarUrl(dto.getAvatarUrl());
        }
        if (dto.getPhone() != null) {
            user.setPhone(dto.getPhone());
        }

        userService.updateById(user);
        return Result.success();
    }

    /**
     * 上传头像文件，返回可供小程序展示的完整 URL（写入 avatar_url 持久化）。
     */
    @PostMapping("/avatar")
    public Result<Map<String, String>> uploadAvatar(@RequestAttribute Long userId,
                                                     @RequestParam("file") MultipartFile file,
                                                     HttpServletRequest request) {
        if (file == null || file.isEmpty()) {
            return Result.error("请选择图片文件");
        }
        String original = file.getOriginalFilename();
        String ext = ".png";
        if (original != null && original.contains(".")) {
            ext = original.substring(original.lastIndexOf('.')).toLowerCase();
            if (!ext.matches("\\.(jpg|jpeg|png|gif|webp)")) {
                ext = ".png";
            }
        }
        String filename = UUID.randomUUID().toString().replace("-", "") + ext;
        try {
            Path dir = Paths.get("uploads", "avatars").toAbsolutePath().normalize();
            Files.createDirectories(dir);
            Path dest = dir.resolve(filename);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (Exception e) {
            return Result.error("上传失败");
        }

        String avatarUrl = buildAvatarPublicUrl(request, filename);

        User user = userService.getById(userId);
        if (user != null) {
            user.setAvatarUrl(avatarUrl);
            userService.updateById(user);
        }

        Map<String, String> data = new HashMap<>();
        data.put("avatarUrl", avatarUrl);
        return Result.success(data);
    }

    private String buildAvatarPublicUrl(HttpServletRequest request, String filename) {
        if (StringUtils.hasText(publicBaseUrl)) {
            String base = publicBaseUrl.trim().replaceAll("/+$", "");
            return base + "/uploads/avatars/" + filename;
        }
        return ServletUriComponentsBuilder.fromContextPath(request)
                .path("/uploads/avatars/")
                .path(filename)
                .build()
                .toUriString();
    }
}
