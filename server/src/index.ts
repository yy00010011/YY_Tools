/**
 * Git Visualizer — Express 应用入口
 * 职责：中间件注册 → 路由挂载 → 静态文件 → 启动
 */
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import logger from './logger';
import rateLimit from './rateLimit';
import basicAuth from './auth';

// 路由模块
import repoRouter from './routes/repo';
import commitsRouter from './routes/commits';
import stagingRouter from './routes/staging';
import branchRouter from './routes/branch';
import remoteRouter from './routes/remote';
import filesRouter from './routes/files';
import stashRouter from './routes/stash';
import advancedRouter from './routes/advanced';

const app = express();
const PORT = process.env.PORT || 3001;

const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((s) => s.trim());

// ==================== 全局中间件 ====================

app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json({ limit: '5mb' }));
// API 限流：读操作 200/分钟，写操作 30/分钟
app.use('/api', rateLimit({ windowMs: 60_000, max: 200 }));

const writeRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: '写操作过于频繁，请稍后再试',
});

app.use('/api/git/stage', writeRateLimit);
app.use('/api/git/unstage', writeRateLimit);
app.use('/api/git/discard', writeRateLimit);
app.use('/api/git/commit', writeRateLimit);
app.use('/api/branch', writeRateLimit);
app.use('/api/tag', writeRateLimit);
app.use('/api/git/push', writeRateLimit);
app.use('/api/git/pull', writeRateLimit);
app.use('/api/git/stash-push', writeRateLimit);
app.use('/api/git/stash-pop', writeRateLimit);
app.use('/api/git/stash-drop', writeRateLimit);
app.use('/api/git/cherry-pick', writeRateLimit);
app.use('/api/git/revert', writeRateLimit);
app.use('/api/git/rebase', writeRateLimit);
app.use('/api/git/rebase-abort', writeRateLimit);
app.use('/api/git/rebase-continue', writeRateLimit);

// 请求日志
app.use((req, _res, next) => {
  const start = Date.now();
  _res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      logger.info(`${req.method} ${req.path}`, { status: _res.statusCode, ms: Date.now() - start });
    }
  });
  next();
});

// 认证（AUTH_USER / AUTH_PASS 未配置时跳过）
app.use('/api', basicAuth);

// ==================== 路由挂载 ====================

app.use('/api', repoRouter);
app.use('/api', commitsRouter);
app.use('/api', stagingRouter);
app.use('/api', branchRouter);
app.use('/api', remoteRouter);
app.use('/api', filesRouter);
app.use('/api', stashRouter);
app.use('/api', advancedRouter);

// ==================== 静态文件服务 ====================

const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err)
        res
          .status(404)
          .json({ message: '前端未构建，请先运行 npm run build 或通过 webpack-dev-server 访问' });
    });
  }
});

// ==================== 启动 ====================

// ==================== 启动配置摘要 ====================

const ALLOWED_ROOTS = (process.env.ALLOWED_ROOTS || '')
  .split(path.delimiter)
  .filter(Boolean);

logger.info('配置摘要', {
  PORT,
  ALLOWED_ROOTS: ALLOWED_ROOTS.length > 0 ? ALLOWED_ROOTS : '(允许所有路径)',
  CORS_ORIGINS,
  AUTH: process.env.AUTH_USER ? `enabled (user: ${process.env.AUTH_USER})` : 'disabled',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  NODE_ENV: process.env.NODE_ENV || 'development',
});

// ==================== 启动 ====================

const server = app.listen(PORT, () => {
  logger.info('Git 可视化服务已启动', { port: Number(PORT) });
  logger.info('API 端点就绪', { endpoint: `http://localhost:${PORT}/api` });
});

// 优雅关闭：防止 Git 操作中断导致锁文件残留
function shutdown(signal: string) {
  logger.info(`收到 ${signal} 信号，正在优雅关闭...`);
  server.close(() => {
    logger.info('HTTP 服务已关闭');
    process.exit(0);
  });
  // 强制超时 10 秒
  setTimeout(() => {
    logger.warn('强制退出（超时）');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
