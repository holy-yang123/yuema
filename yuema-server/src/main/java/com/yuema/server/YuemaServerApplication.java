package com.yuema.server;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.yuema.server.mapper")
public class YuemaServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(YuemaServerApplication.class, args);
    }
}
