package com.yuema.server.controller;

import com.yuema.server.dto.ScoreRecordDTO;
import com.yuema.server.entity.ScoreRecord;
import com.yuema.server.service.ScoreService;
import com.yuema.server.vo.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/score")
public class ScoreController {

    @Autowired
    private ScoreService scoreService;

    @PostMapping("/record")
    public Result<Void> recordScores(@RequestAttribute Long userId,
                                      @RequestBody @Validated ScoreRecordDTO dto) {
        boolean success = scoreService.recordScores(userId, dto);
        if (!success) {
            return Result.error("记分失败");
        }
        return Result.success();
    }

    @GetMapping("/list")
    public Result<List<ScoreRecord>> getRoomScores(@RequestParam Long roomId) {
        List<ScoreRecord> records = scoreService.getRoomScores(roomId);
        return Result.success(records);
    }

    @GetMapping("/summary")
    public Result<Map<String, Object>> getScoreSummary(@RequestParam Long roomId) {
        Map<String, Object> summary = scoreService.getScoreSummary(roomId);
        return Result.success(summary);
    }

    @GetMapping("/round")
    public Result<List<ScoreRecord>> getRoundScores(@RequestParam Long roomId,
                                                     @RequestParam Integer roundNo) {
        List<ScoreRecord> records = scoreService.getRoundScores(roomId, roundNo);
        return Result.success(records);
    }

    @DeleteMapping("/round")
    public Result<Void> deleteRoundScore(@RequestAttribute Long userId,
                                          @RequestParam Long roomId,
                                          @RequestParam Integer roundNo) {
        boolean success = scoreService.deleteRoundScore(roomId, roundNo, userId);
        if (!success) {
            return Result.error("删除失败，无权限");
        }
        return Result.success();
    }

    @GetMapping("/settlement")
    public Result<Map<String, Object>> getSettlement(@RequestParam Long roomId) {
        Map<String, Object> settlement = scoreService.calculateSettlement(roomId);
        return Result.success(settlement);
    }
}
