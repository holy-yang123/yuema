package com.yuema.server.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.yuema.server.entity.Venue;
import com.yuema.server.entity.VenueRoom;
import com.yuema.server.mapper.VenueMapper;
import com.yuema.server.mapper.VenueRoomMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class VenueService extends ServiceImpl<VenueMapper, Venue> {

    @Autowired
    private VenueRoomMapper venueRoomMapper;

    public List<Venue> getActiveVenues() {
        return baseMapper.selectActiveVenues();
    }

    public List<Venue> getNearbyVenues(Double longitude, Double latitude, Integer limit) {
        if (limit == null || limit <= 0) {
            limit = 10;
        }
        return baseMapper.selectNearbyVenues(longitude, latitude, limit);
    }

    public List<VenueRoom> getVenueRooms(Long venueId) {
        return venueRoomMapper.selectByVenueId(venueId);
    }

    public VenueRoom getRoomDetail(Long roomId) {
        return venueRoomMapper.selectById(roomId);
    }
}
