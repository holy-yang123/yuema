package com.yuema.server.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.yuema.server.entity.User;
import com.yuema.server.mapper.UserMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Objects;

@Service
public class UserService extends ServiceImpl<UserMapper, User> {

    public User getByOpenid(String openid) {
        return baseMapper.selectByOpenid(openid);
    }

    public User getByPhone(String phone) {
        return baseMapper.selectByPhone(phone);
    }

    public User createUser(String openid, String nickname, String avatarUrl) {
        Objects.requireNonNull(openid, "openid");
        User user = new User();
        user.setOpenid(openid);
        user.setNickname(nickname);
        user.setAvatarUrl(avatarUrl);
        user.setLevel(1);
        user.setScore(0);
        user.setTotalGames(0);
        user.setWinGames(0);
        user.setStatus(1);
        user.setLastLoginTime(LocalDateTime.now());
        save(user);
        return user;
    }

    public void updateLoginTime(Long userId) {
        User user = getById(userId);
        if (user != null) {
            user.setLastLoginTime(LocalDateTime.now());
            updateById(user);
        }
    }

    public void updateUserStats(Long userId, boolean isWin) {
        User user = getById(userId);
        if (user != null) {
            user.setTotalGames(user.getTotalGames() + 1);
            if (isWin) {
                user.setWinGames(user.getWinGames() + 1);
            }
            updateById(user);
        }
    }
}
