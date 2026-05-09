package com.yuema.server.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.yuema.server.entity.User;
import com.yuema.server.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Objects;

@Service
public class UserService extends ServiceImpl<UserMapper, User> {

    @Autowired
    private WxMiniAppService wxMiniAppService;

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
        // 新用户默认满信誉，未走微信手机号核验前不可信标记为 0
        user.setReputationScore(100);
        user.setRealnameVerified(0);
        user.setStatus(1);
        user.setLastLoginTime(LocalDateTime.now());
        save(user);
        return user;
    }

    /**
     * 爽约等场景扣减信誉分，不低于 0。
     *
     * @return 扣减后的信誉分；用户不存在返回 -1
     */
    public int decreaseReputation(Long userId, int delta) {
        User u = getById(userId);
        if (u == null) {
            return -1;
        }
        int base = u.getReputationScore() != null ? u.getReputationScore() : 100;
        int next = Math.max(0, base - Math.max(0, delta));
        u.setReputationScore(next);
        updateById(u);
        return next;
    }

    /**
     * 使用微信 getPhoneNumber 动态令牌换取手机号并标记可信身份（弱实名，可后续接人脸/证号通道）。
     *
     * @return null 成功；NOT_FOUND / PHONE_TAKEN / WX_FAIL:msg
     */
    @Transactional
    public String bindWxPhoneNumber(Long userId, String wxPhoneCode) {
        User user = getById(userId);
        if (user == null) {
            return "NOT_FOUND";
        }
        String phone;
        try {
            phone = wxMiniAppService.fetchWxPhoneNumber(wxPhoneCode);
        } catch (Exception e) {
            return "WX_FAIL:" + e.getMessage();
        }
        User other = baseMapper.selectByPhone(phone);
        if (other != null && !other.getId().equals(userId)) {
            return "PHONE_TAKEN";
        }
        user.setPhone(phone);
        user.setRealnameVerified(1);
        updateById(user);
        return null;
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

    /**
     * 牌局结束：累计总局数、胜局、积分（finalScore 可正可负）
     */
    public void accumulateGameResult(Long userId, int finalScore, boolean isWinner) {
        User user = getById(userId);
        if (user == null) {
            return;
        }
        int tg = user.getTotalGames() == null ? 0 : user.getTotalGames();
        int wg = user.getWinGames() == null ? 0 : user.getWinGames();
        int sc = user.getScore() == null ? 0 : user.getScore();
        user.setTotalGames(tg + 1);
        if (isWinner) {
            user.setWinGames(wg + 1);
        }
        user.setScore(sc + finalScore);
        updateById(user);
    }
}
