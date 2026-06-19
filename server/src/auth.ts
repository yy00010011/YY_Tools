/**
 * HTTP Basic Auth 中间件
 * 通过 AUTH_USER / AUTH_PASS 环境变量配置。
 * 未配置时跳过认证（向后兼容）。
 *
 * 使用 crypto.timingSafeEqual 做常量时间比较，防止时序攻击。
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export default function basicAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = process.env.AUTH_USER;
  const pass = process.env.AUTH_PASS;

  // 未配置则跳过
  if (!user || !pass) return next();

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Git Visualizer", charset="UTF-8"');
    res.status(401).json({ error: '需要认证，请提供用户名和密码' });
    return;
  }

  const encoded = authHeader.substring(6);
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    res.status(401).json({ error: '认证信息格式无效' });
    return;
  }

  const colonIdx = decoded.indexOf(':');
  if (colonIdx <= 0) {
    res.status(401).json({ error: '认证信息格式无效' });
    return;
  }

  const reqUser = decoded.substring(0, colonIdx);
  const reqPass = decoded.substring(colonIdx + 1);

  // 常量时间比较防止时序攻击 (Node 6+)
  const userOk = crypto.timingSafeEqual(Buffer.from(reqUser), Buffer.from(user));
  const passOk = crypto.timingSafeEqual(Buffer.from(reqPass), Buffer.from(pass));

  if (!userOk || !passOk) {
    res.set('WWW-Authenticate', 'Basic realm="Git Visualizer", charset="UTF-8"');
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  next();
}
