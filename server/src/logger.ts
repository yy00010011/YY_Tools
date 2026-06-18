/**
 * 轻量级结构化日志（无外部依赖）
 * 输出 ISO 时间戳 + 级别 + 消息
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogExtra = Record<string, unknown>;

const levels: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel: number = levels[(process.env.LOG_LEVEL as LogLevel) || 'info'] ?? levels.info;

function log(level: LogLevel, msg: string, extra: LogExtra = {}): void {
  if (levels[level] < currentLevel) return;
  const entry = {
    time: new Date().toISOString(),
    level,
    msg,
    ...extra
  };
  const out = process.env.NODE_ENV === 'production'
    ? JSON.stringify(entry)
    : `[${entry.time}] ${level.toUpperCase()} ${msg}`;
  if (level === 'error') console.error(out, extra.err ?? '');
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

export default {
  debug: (msg: string, extra?: LogExtra) => log('debug', msg, extra),
  info: (msg: string, extra?: LogExtra) => log('info', msg, extra),
  warn: (msg: string, extra?: LogExtra) => log('warn', msg, extra),
  error: (msg: string, extra?: LogExtra) => log('error', msg, extra),
};
