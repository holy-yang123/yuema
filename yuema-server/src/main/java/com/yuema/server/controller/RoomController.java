package com.yuema.server.controller;

import com.yuema.server.dto.CreateRoomDTO;
import com.yuema.server.dto.JoinRoomDTO;
import com.yuema.server.entity.Room;
import com.yuema.server.entity.RoomMember;
import com.yuema.server.entity.User;
import com.yuema.server.service.RoomService;
import com.yuema.server.service.UserService;
import com.yuema.server.service.WxMiniAppService;
import com.yuema.server.vo.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import javax.servlet.http.HttpServletRequest;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
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

    @Autowired
    private WxMiniAppService wxMiniAppService;

    @Value("${yuema.public-base-url:}")
    private String publicBaseUrl;

    @PostMapping("/create")
    public Result<Room> createRoom(@RequestAttribute Long userId,
                                    @RequestBody @Validated CreateRoomDTO dto) {
        Room room = roomService.createRoom(userId, dto);
        return Result.success(room);
    }

    @PostMapping("/join")
    public Result<Void> joinRoom(@RequestAttribute Long userId,
                                  @RequestBody @Validated JoinRoomDTO dto) {
        String roomNo = dto.getRoomNo();
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
    public Result<List<Room>> getRoomList(@RequestParam(required = false) Double longitude,
                                           @RequestParam(required = false) Double latitude) {
        List<Room> rooms = roomService.getActiveRooms(longitude, latitude);
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

    @PostMapping("/leave")
    public Result<Void> leaveRoom(@RequestAttribute Long userId, @RequestParam Long roomId) {
        String err = roomService.leaveRoom(roomId, userId);
        if (err != null) {
            if ("HOST_CANNOT_LEAVE".equals(err)) {
                return Result.error("房主请先转让房主或结束牌局");
            }
            return Result.error("离开失败");
        }
        return Result.success();
    }

    @PostMapping("/kick")
    public Result<Void> kick(@RequestAttribute Long userId,
                            @RequestParam Long roomId,
                            @RequestParam Long targetUserId) {
        String err = roomService.kickMember(roomId, userId, targetUserId);
        if (err != null) {
            return Result.error("踢人失败");
        }
        return Result.success();
    }

    @PostMapping("/transfer")
    public Result<Void> transfer(@RequestAttribute Long userId,
                                 @RequestParam Long roomId,
                                 @RequestParam Long newOwnerId) {
        String err = roomService.transferRoom(roomId, userId, newOwnerId);
        if (err != null) {
            return Result.error("转让失败");
        }
        return Result.success();
    }

    @GetMapping("/qrcode")
    public Result<Map<String, String>> roomQrCode(@RequestAttribute Long userId,
                                                   @RequestParam Long roomId,
                                                   HttpServletRequest request) {
        Room room = roomService.getById(roomId);
        if (room == null) {
            return Result.error("房间不存在");
        }
        if (!roomService.isActiveMember(roomId, userId)) {
            return Result.error("无权生成二维码");
        }
        byte[] png;
        try {
            png = wxMiniAppService.getWxaCodeUnlimited(room.getRoomNo(), "pages/room/detail");
        } catch (Exception e) {
            return Result.error("生成小程序码失败: " + e.getMessage());
        }
        String filename = room.getRoomNo() + ".png";
        try {
            Path dir = Paths.get("uploads", "qrcodes").toAbsolutePath().normalize();
            Files.createDirectories(dir);
            Path dest = dir.resolve(filename);
            try (InputStream in = new java.io.ByteArrayInputStream(png)) {
                Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (Exception e) {
            return Result.error("保存二维码失败");
        }
        String url = buildQrPublicUrl(request, filename);
        Map<String, String> data = new HashMap<>();
        data.put("qrUrl", url);
        data.put("roomNo", room.getRoomNo());
        return Result.success(data);
    }

    private String buildQrPublicUrl(HttpServletRequest request, String filename) {
        if (StringUtils.hasText(publicBaseUrl)) {
            String base = publicBaseUrl.trim().replaceAll("/+$", "");
            return base + "/uploads/qrcodes/" + filename;
        }
        return ServletUriComponentsBuilder.fromContextPath(request)
                .path("/uploads/qrcodes/")
                .path(filename)
                .build()
                .toUriString();
    }
}
