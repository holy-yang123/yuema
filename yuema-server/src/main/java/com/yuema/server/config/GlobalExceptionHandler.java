package com.yuema.server.config;

import com.yuema.server.vo.Result;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 将可预期的参数/反序列化问题转为 JSON，避免小程序端收到 HTTP 500 HTML 只能提示「网络错误」。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public Result<Void> illegalArgument(IllegalArgumentException e) {
        return Result.error(e.getMessage() != null ? e.getMessage() : "参数错误");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public Result<Void> notReadable(HttpMessageNotReadableException e) {
        return Result.error("请求体格式错误");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> notValid(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(err -> err.getDefaultMessage())
                .orElse("参数校验失败");
        return Result.error(msg);
    }
}
