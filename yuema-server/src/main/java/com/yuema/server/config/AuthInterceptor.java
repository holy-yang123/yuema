package com.yuema.server.config;

import com.alibaba.fastjson2.JSON;
import com.yuema.server.utils.JwtUtil;
import com.yuema.server.vo.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.PrintWriter;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    @Autowired
    private JwtUtil jwtUtil;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String token = request.getHeader("Authorization");
        
        if (token == null || !token.startsWith("Bearer ")) {
            writeError(response, "未登录");
            return false;
        }

        token = token.substring(7);
        
        if (!jwtUtil.validateToken(token)) {
            writeError(response, "登录已过期");
            return false;
        }

        Long userId = jwtUtil.getUserIdFromToken(token);
        request.setAttribute("userId", userId);
        
        return true;
    }

    private void writeError(HttpServletResponse response, String message) throws Exception {
        response.setContentType("application/json;charset=UTF-8");
        response.setStatus(401);
        PrintWriter writer = response.getWriter();
        writer.write(JSON.toJSONString(Result.error(401, message)));
        writer.flush();
        writer.close();
    }
}
