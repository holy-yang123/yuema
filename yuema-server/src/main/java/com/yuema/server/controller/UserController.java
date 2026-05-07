package com.yuema.server.controller;

import com.yuema.server.dto.LoginDTO;
import com.yuema.server.dto.UpdateUserDTO;
import com.yuema.server.entity.User;
import com.yuema.server.service.UserService;
import com.yuema.server.service.WxMiniAppService;
import com.yuema.server.utils.JwtUtil;
import com.yuema.server.vo.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
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
