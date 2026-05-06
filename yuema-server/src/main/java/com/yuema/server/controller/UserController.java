package com.yuema.server.controller;

import com.yuema.server.dto.LoginDTO;
import com.yuema.server.entity.User;
import com.yuema.server.service.UserService;
import com.yuema.server.utils.JwtUtil;
import com.yuema.server.vo.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/user")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping("/login")
    public Result<Map<String, Object>> login(@RequestBody LoginDTO dto) {
        User user = userService.getByOpenid(dto.getOpenid());
        
        // 逻辑升级：如果用户不存在，或者用户存在但昵称为空，且当前请求也没传昵称
        // 则视为需要“完善资料”
        boolean isMissingProfile = (user == null) || (user.getNickname() == null || user.getNickname().isEmpty());
        boolean isNoNewProfileProvided = (dto.getNickname() == null || dto.getNickname().isEmpty());

        if (isMissingProfile && isNoNewProfileProvided) {
            return Result.error(404, "NEED_PROFILE");
        }

        if (user == null) {
            user = userService.createUser(dto.getOpenid(), dto.getNickname(), dto.getAvatarUrl());
        } else {
            // 如果传了新的头像昵称，更新资料
            if (dto.getNickname() != null && !dto.getNickname().isEmpty()) {
                user.setNickname(dto.getNickname());
                user.setAvatarUrl(dto.getAvatarUrl());
            }
            userService.updateLoginTime(user.getId());
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
    public Result<Void> updateUserInfo(@RequestAttribute Long userId,
                                        @RequestParam(required = false) String nickname,
                                        @RequestParam(required = false) String avatarUrl,
                                        @RequestParam(required = false) String phone) {
        User user = userService.getById(userId);
        if (user == null) {
            return Result.error("用户不存在");
        }

        if (nickname != null) user.setNickname(nickname);
        if (avatarUrl != null) user.setAvatarUrl(avatarUrl);
        if (phone != null) user.setPhone(phone);

        userService.updateById(user);
        return Result.success();
    }
}
