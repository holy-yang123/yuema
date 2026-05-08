package com.yuema.server.controller;

import com.yuema.server.dto.ScoreRecordDTO;
import com.yuema.server.entity.ScoreRecord;
import com.yuema.server.service.ScoreModifyService;
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

    @Autowired
    private ScoreModifyService scoreModifyService;

    @PostMapping("/record")
    public Result<Void> recordScores(@RequestAttribute Long userId,
                                      @RequestBody @Validated ScoreRecordDTO dto) {
        String err = scoreService.recordScores(userId, dto);
        if (err != null) {
            if ("ROUND_EXISTS".equals(err)) {
                return Result.error(409, "ROUND_EXISTS");
            }
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

    @PostMapping("/modify-request")
    public Result<Void> modifyRequest(@RequestAttribute Long userId,
                                      @RequestBody @Validated ScoreRecordDTO dto) {
        String err = scoreModifyService.createRequest(userId, dto);
        if (err != null) {
            return mapModifyError(err);
        }
        return Result.success();
    }

    @PostMapping("/modify-vote")
    public Result<Void> modifyVote(@RequestAttribute Long userId, @RequestBody Map<String, Object> body) {
        Object rid = body.get("requestId");
        Object v = body.get("vote");
        if (rid == null || v == null) {
            return Result.error("参数错误");
        }
        Long requestId = Long.valueOf(rid.toString());
        int vote = Integer.parseInt(v.toString());
        String err = scoreModifyService.vote(userId, requestId, vote);
        if (err != null) {
            return mapModifyError(err);
        }
        return Result.success();
    }

    @PostMapping("/modify-cancel")
    public Result<Void> modifyCancel(@RequestAttribute Long userId, @RequestBody Map<String, Object> body) {
        Object rid = body.get("requestId");
        if (rid == null) {
            return Result.error("参数错误");
        }
        Long requestId = Long.valueOf(rid.toString());
        String err = scoreModifyService.cancel(userId, requestId);
        if (err != null) {
            return mapModifyError(err);
        }
        return Result.success();
    }

    @GetMapping("/modify-pending")
    public Result<Map<String, Object>> modifyPending(@RequestAttribute Long userId,
                                                      @RequestParam Long roomId) {
        Map<String, Object> data = scoreModifyService.getPending(userId, roomId);
        if (data == null) {
            return Result.error("无权查看");
        }
        return Result.success(data);
    }

    private Result<Void> mapModifyError(String err) {
        switch (err) {
            case "NOT_HOST":
                return Result.error(403, "仅房主可发起修改");
            case "PENDING_EXISTS":
                return Result.error(409, "已有待处理修改申请");
            case "NO_SCORE":
                return Result.error("该局尚无记分");
            case "NO_VOTERS":
                return Result.error("无其他玩家可投票");
            case "ROOM_INVALID":
                return Result.error("牌局不存在或未进行中");
            case "HOST_CANNOT_VOTE":
                return Result.error("房主不能投票");
            case "NOT_MEMBER":
                return Result.error("非房间成员");
            case "ALREADY_VOTED":
                return Result.error("已投过票");
            case "BAD_VOTE":
                return Result.error("投票参数错误");
            case "INVALID":
                return Result.error("申请无效或已结束");
            case "BAD_PAYLOAD":
                return Result.error("分数数据不能为空");
            default:
                return Result.error(err);
        }
    }
}
