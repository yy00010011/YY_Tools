/**
 * 轻量级 API 限流中间件（无外部依赖）
 * 基于滑动窗口 + 内存 Map，适合单机部署
 */
import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  /** 窗口大小（毫秒），默认 60 秒 */
  windowMs?: number;
  /** 窗口内最大请求数，默认 100 */
  max?: number;
  /** 限流提示消息 */
  message?: string;
}

const WINDOW_MS = 60_000; // 1 分钟
const MAX_REQUESTS = 200;
const CLEANUP_INTERVAL = 300_000; // 5 分钟清理一次过期条目

const store = new Map<string, RateLimitEntry>();

// 定期清理过期条目，避免内存泄漏
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL).unref(); // unref 防止定时器阻止进程退出

export default function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs || WINDOW_MS;
  const max = options.max || MAX_REQUESTS;
  const message = options.message || '请求过于频繁，请稍后再试';

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      // 新窗口
      entry = { count: 1, resetAt: now + windowMs };
      store.set(key, entry);
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', String(max - 1));
      res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
      return next();
    }

    entry.count++;
    const remaining = Math.max(0, max - entry.count);
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      return res.status(429).json({ error: message });
    }

    next();
  };
}
