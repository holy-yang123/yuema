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
        
        if (user == null) {
            user = userService.createUser(dto.getOpenid(), dto.getNickname(), dto.getAvatarUrl());
        } else {
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
