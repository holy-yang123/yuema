package com.yuema.server.utils;

import java.util.Random;

public class RoomNoGenerator {

    private static final Random random = new Random();

    public static String generate() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            sb.append(random.nextInt(10));
        }
        return sb.toString();
    }
}
