package com.yuema.server.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.yuema.server.entity.Order;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface OrderMapper extends BaseMapper<Order> {
    
    @Select("SELECT * FROM orders WHERE order_no = #{orderNo}")
    Order selectByOrderNo(@Param("orderNo") String orderNo);
    
    @Select("SELECT * FROM orders WHERE user_id = #{userId} ORDER BY created_at DESC")
    List<Order> selectByUserId(@Param("userId") Long userId);
    
    @Select("SELECT * FROM orders WHERE venue_room_id = #{roomId} AND booking_date = #{date} " +
            "AND status IN (1,2,3)")
    List<Order> selectBookedOrders(@Param("roomId") Long roomId, @Param("date") LocalDate date);
}
