package com.yuema.server.controller;

import com.yuema.server.dto.CreateRoomDTO;
import com.yuema.server.entity.Room;
import com.yuema.server.entity.RoomMember;
import com.yuema.server.entity.User;
import com.yuema.server.service.RoomService;
import com.yuema.server.service.UserService;
import com.yuema.server.vo.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/room")
public class RoomController {

    @Autowired
    private RoomService roomService;

    @Autowired
    private UserService userService;

    @PostMapping("/create")
    public Result<Room> createRoom(@RequestAttribute Long userId,
                                    @RequestBody @Validated CreateRoomDTO dto) {
        Room room = roomService.createRoom(userId, dto);
        return Result.success(room);
    }

    @PostMapping("/join")
    public Result<Void> joinRoom(@RequestAttribute Long userId,
                                  @RequestParam String roomNo) {
        Room room = roomService.getByRoomNo(roomNo);
        if (room == null) {
            return Result.error("房间不存在");
        }

        boolean success = roomService.joinRoom(room.getId(), userId);
        if (!success) {
            return Result.error("加入房间失败，可能房间已满或已结束");
        }

        return Result.success();
    }

    @GetMapping("/info")
    public Result<Map<String, Object>> getRoomInfo(@RequestParam Long roomId) {
        Room room = roomService.getById(roomId);
        if (room == null) {
            return Result.error("房间不存在");
        }

        List<RoomMember> members = roomService.getRoomMembers(roomId);
        List<Map<String, Object>> memberList = members.stream().map(m -> {
            Map<String, Object> map = new HashMap<>();
            User user = userService.getById(m.getUserId());
            map.put("userId", m.getUserId());
            map.put("nickname", user != null ? user.getNickname() : "");
            map.put("avatarUrl", user != null ? user.getAvatarUrl() : "");
            map.put("role", m.getRole());
            map.put("seatNo", m.getSeatNo());
            return map;
        }).collect(Collectors.toList());

        Map<String, Object> data = new HashMap<>();
        data.put("room", room);
        data.put("members", memberList);

        return Result.success(data);
    }

    @GetMapping("/list")
    public Result<List<Room>> getRoomList() {
        List<Room> rooms = roomService.getActiveRooms();
        return Result.success(rooms);
    }

    @GetMapping("/my")
    public Result<List<Room>> getMyRooms(@RequestAttribute Long userId) {
        List<Room> rooms = roomService.getMyRooms(userId);
        return Result.success(rooms);
    }

    @PostMapping("/start")
    public Result<Void> startRoom(@RequestAttribute Long userId,
                                   @RequestParam Long roomId) {
        boolean success = roomService.startRoom(roomId, userId);
        if (!success) {
            return Result.error("开始牌局失败");
        }
        return Result.success();
    }

    @PostMapping("/end")
    public Result<Void> endRoom(@RequestAttribute Long userId,
                                 @RequestParam Long roomId) {
        boolean success = roomService.endRoom(roomId, userId);
        if (!success) {
            return Result.error("结束牌局失败");
        }
        return Result.success();
    }
}
