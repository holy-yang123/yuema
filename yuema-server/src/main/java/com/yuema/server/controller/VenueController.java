package com.yuema.server.controller;

import com.yuema.server.entity.Venue;
import com.yuema.server.entity.VenueRoom;
import com.yuema.server.service.VenueService;
import com.yuema.server.vo.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/venue")
public class VenueController {

    @Autowired
    private VenueService venueService;

    @GetMapping("/list")
    public Result<List<Venue>> getVenueList() {
        List<Venue> venues = venueService.getActiveVenues();
        return Result.success(venues);
    }

    @GetMapping("/nearby")
    public Result<List<Venue>> getNearbyVenues(@RequestParam Double longitude,
                                                @RequestParam Double latitude,
                                                @RequestParam(required = false, defaultValue = "10") Integer limit) {
        List<Venue> venues = venueService.getNearbyVenues(longitude, latitude, limit);
        return Result.success(venues);
    }

    @GetMapping("/detail")
    public Result<Venue> getVenueDetail(@RequestParam Long venueId) {
        Venue venue = venueService.getById(venueId);
        if (venue == null) {
            return Result.error("场地不存在");
        }
        return Result.success(venue);
    }

    @GetMapping("/rooms")
    public Result<List<VenueRoom>> getVenueRooms(@RequestParam Long venueId) {
        List<VenueRoom> rooms = venueService.getVenueRooms(venueId);
        return Result.success(rooms);
    }
}
