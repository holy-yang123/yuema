/**
 * 牌局 WebSocket：wx.connectSocket、25s 心跳 ping、30s 封顶指数退避重连、按 type 订阅
 */

function getAppSafe() {
  try {
    return getApp();
  } catch (e) {
    return null;
  }
}

function buildWsUrl() {
  const app = getAppSafe();
  const apiBase = (app && app.globalData && app.globalData.apiBaseUrl) || '';
  const token = (app && app.globalData && app.globalData.token) || '';
  const wsBase = apiBase.replace(/^http/i, 'ws');
  return `${wsBase}/ws/room?token=${encodeURIComponent(token)}`;
}

function createRoomSocket() {
  const listeners = {};
  let socketTask = null;
  let heartbeatTimer = null;
  let reconnectTimer = null;
  let manualClose = false;
  let reconnectAttempt = 0;
  let joinedRoomId = null;

  function emit(type, payload) {
    const list = listeners[type];
    if (list) {
      list.slice().forEach((fn) => {
        try {
          fn(payload);
        } catch (e) {
          console.error('socket listener', e);
        }
      });
    }
    const star = listeners['*'];
    if (star) {
      star.slice().forEach((fn) => {
        try {
          fn({ type, payload });
        } catch (e) {
          console.error('socket * listener', e);
        }
      });
    }
  }

  function clearHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function clearReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function startHeartbeat(task) {
    clearHeartbeat();
    heartbeatTimer = setInterval(() => {
      try {
        task.send({
          data: JSON.stringify({ type: 'ping' })
        });
      } catch (e) {
        // ignore
      }
    }, 25000);
  }

  function scheduleReconnect() {
    if (manualClose || !joinedRoomId) {
      return;
    }
    clearReconnect();
    const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempt));
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect(joinedRoomId);
    }, delay);
  }

  function attachHandlers(task, roomId) {
    task.onOpen(() => {
      reconnectAttempt = 0;
      clearReconnect();
      startHeartbeat(task);
      try {
        task.send({
          data: JSON.stringify({ type: 'join', roomId })
        });
      } catch (e) {
        console.error('ws join send', e);
      }
      emit('open', {});
    });

    task.onMessage((res) => {
      let msg = res.data;
      if (typeof msg === 'string') {
        try {
          msg = JSON.parse(msg);
        } catch (e) {
          return;
        }
      }
      if (!msg || typeof msg !== 'object') {
        return;
      }
      if (msg.type) {
        emit(msg.type, msg);
      }
    });

    task.onError((err) => {
      emit('socket_error', err);
    });

    task.onClose(() => {
      clearHeartbeat();
      if (socketTask !== task) {
        return;
      }
      socketTask = null;
      emit('close', {});
      if (!manualClose) {
        scheduleReconnect();
      }
    });
  }

  function connect(roomId) {
    const app = getAppSafe();
    if (!app || !app.globalData || !app.globalData.token) {
      return;
    }
    joinedRoomId = roomId;
    manualClose = false;

    const prev = socketTask;
    const task = wx.connectSocket({
      url: buildWsUrl(),
      fail: (e) => {
        emit('socket_error', e);
        if (socketTask === task) {
          socketTask = null;
        }
        scheduleReconnect();
      }
    });
    if (!task) {
      scheduleReconnect();
      return;
    }
    socketTask = task;
    attachHandlers(task, roomId);
    if (prev) {
      try {
        prev.close({ code: 1000, reason: 'reconnect' });
      } catch (e) {
        // ignore
      }
    }
  }

  function send(obj) {
    if (!socketTask) {
      return false;
    }
    try {
      socketTask.send({ data: typeof obj === 'string' ? obj : JSON.stringify(obj) });
      return true;
    } catch (e) {
      return false;
    }
  }

  function on(type, fn) {
    if (!listeners[type]) {
      listeners[type] = [];
    }
    listeners[type].push(fn);
  }

  function off(type, fn) {
    const list = listeners[type];
    if (!list) {
      return;
    }
    const i = list.indexOf(fn);
    if (i >= 0) {
      list.splice(i, 1);
    }
  }

  function close() {
    manualClose = true;
    joinedRoomId = null;
    reconnectAttempt = 0;
    clearHeartbeat();
    clearReconnect();
    if (socketTask) {
      try {
        socketTask.send({ data: JSON.stringify({ type: 'leave' }) });
      } catch (e) {
        // ignore
      }
      try {
        socketTask.close({ code: 1000, reason: 'page' });
      } catch (e) {
        // ignore
      }
      socketTask = null;
    }
  }

  return {
    connect,
    close,
    send,
    on,
    off
  };
}

module.exports = {
  createRoomSocket
};
