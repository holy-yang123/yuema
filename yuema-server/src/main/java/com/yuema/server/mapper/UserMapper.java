package com.yuema.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.yuema.server.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserMapper extends BaseMapper<User> {
    
    @Select("SELECT * FROM users WHERE openid = #{openid} AND deleted = 0")
    User selectByOpenid(@Param("openid") String openid);
    
    @Select("SELECT * FROM users WHERE phone = #{phone} AND deleted = 0")
    User selectByPhone(@Param("phone") String phone);
}
