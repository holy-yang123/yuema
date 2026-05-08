package com.yuema.server.controller;

import com.yuema.server.service.ChatService;
import com.yuema.server.vo.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/chat")
public class ChatController {

    @Autowired
    private ChatService chatService;

    @GetMapping("/list")
    public Result<List<Map<String, Object>>> list(@RequestAttribute Long userId,
                                                   @RequestParam Long roomId,
                                                   @RequestParam(required = false) Long before,
                                                   @RequestParam(required = false, defaultValue = "50") Integer limit) {
        List<Map<String, Object>> list = chatService.listMessages(roomId, userId, before, limit != null ? limit : 50);
        return Result.success(list);
    }
}
