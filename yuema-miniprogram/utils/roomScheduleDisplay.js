/**
 * 计划开始时间窗口与预计时长：服务端 LocalDateTime 可能为 "yyyy-MM-dd HH:mm:ss" 或 ISO 字符串
 */

function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

/** 将接口日期统一成可解析的本地时间串（无 Z） */
function normalizeApiDateTime(v) {
  if (v == null || v === '') {
    return null;
  }
  if (typeof v === 'string') {
    return v.indexOf(' ') >= 0 ? v.replace(' ', 'T') : v;
  }
  if (Array.isArray(v) && v.length >= 5) {
    const y = v[0];
    const mo = v[1];
    const d = v[2];
    const h = v[3];
    const mi = v[4];
    const s = v.length > 5 ? v[5] : 0;
    return `${y}-${pad2(mo)}-${pad2(d)}T${pad2(h)}:${pad2(mi)}:${pad2(s)}`;
  }
  return null;
}

function parseLocalDate(str) {
  const n = normalizeApiDateTime(str);
  if (!n) {
    return null;
  }
  const m = n.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    return null;
  }
  return {
    y: parseInt(m[1], 10),
    mo: parseInt(m[2], 10),
    d: parseInt(m[3], 10),
    h: parseInt(m[4], 10),
    mi: parseInt(m[5], 10)
  };
}

function sameCalendarDay(a, b) {
  return a && b && a.y === b.y && a.mo === b.mo && a.d === b.d;
}

/** @returns {string} 空串表示无可展示 */
function formatStartWindowText(begin, end) {
  const pb = parseLocalDate(begin);
  const pe = parseLocalDate(end);
  if (!pb && !pe) {
    return '';
  }
  if (pb && !pe) {
    return `${pb.mo}月${pb.d}日 ${pad2(pb.h)}:${pad2(pb.mi)}起`;
  }
  if (!pb && pe) {
    return `最晚 ${pe.mo}月${pe.d}日 ${pad2(pe.h)}:${pad2(pe.mi)}`;
  }
  if (sameCalendarDay(pb, pe)) {
    return `${pb.mo}月${pb.d}日 ${pad2(pb.h)}:${pad2(pb.mi)}–${pad2(pe.h)}:${pad2(pe.mi)}`;
  }
  return `${pb.mo}月${pb.d}日 ${pad2(pb.h)}:${pad2(pb.mi)} – ${pe.mo}月${pe.d}日 ${pad2(pe.h)}:${pad2(pe.mi)}`;
}

/** @returns {string} 按小时展示（非整点保留一位小数小时） */
function formatDurationText(minutes) {
  if (minutes == null || minutes === '' || Number.isNaN(Number(minutes))) {
    return '';
  }
  const m = Number(minutes);
  if (m <= 0) {
    return '';
  }
  const h = m / 60;
  if (m % 60 === 0) {
    return `约${h}小时`;
  }
  const rounded = Math.round(h * 10) / 10;
  return `约${rounded}小时`;
}

/** 从房间对象取字段（兼容 snake_case） */
function pickScheduleFields(room) {
  if (!room) {
    return { begin: null, end: null, minutes: null };
  }
  const begin = room.startWindowBegin != null ? room.startWindowBegin : room.start_window_begin;
  const end = room.startWindowEnd != null ? room.startWindowEnd : room.start_window_end;
  const minutes = room.durationMinutes != null ? room.durationMinutes : room.duration_minutes;
  return { begin, end, minutes };
}

/** 列表/详情附加展示字段 */
function attachScheduleDisplay(room) {
  const { begin, end, minutes } = pickScheduleFields(room);
  return {
    ...room,
    scheduleDisplayStart: formatStartWindowText(begin, end),
    scheduleDisplayDuration: formatDurationText(minutes)
  };
}

/** 供创建页 picker 回填：接口 datetime → yyyy-MM-dd 与 HH:mm */
function splitPickerDateTime(apiVal) {
  const n = normalizeApiDateTime(apiVal);
  if (!n) {
    return { date: '', time: '' };
  }
  let m = n.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!m) {
    m = n.replace(' ', 'T').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  }
  if (!m) {
    return { date: '', time: '' };
  }
  return { date: m[1], time: m[2] };
}

module.exports = {
  normalizeApiDateTime,
  formatStartWindowText,
  formatDurationText,
  attachScheduleDisplay,
  pickScheduleFields,
  splitPickerDateTime
};
