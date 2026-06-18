import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import {
  GitServiceError,
  isGitRepo,
  getBranches,
  getTags,
  getCommitLog,
  getCommitDiff,
  getStatus,
  getCurrentBranch,
  stageFiles,
  unstageFiles,
  discardFiles,
  commit,
  createBranch,
  switchBranch,
  mergeBranch,
  deleteBranch,
  getFileTree,
  getFileContent,
  getUnstagedDiff,
  getStagedDiff,
  getUnpushedCount,
  pushBranch,
} from './gitService';
import logger from './logger';
import type { LogResponse, StatusResponse, ActionResponse } from './types';

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ROOTS = (process.env.ALLOWED_ROOTS || '').split(path.delimiter).filter(Boolean);
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim());

app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      logger.info(`${req.method} ${req.path}`, { status: res.statusCode, ms: Date.now() - start });
    }
  });
  next();
});

// ==================== 安全校验 ====================

const HASH_RE = /^[a-zA-Z0-9_\-./^~]{4,64}$/;
function validateHash(hash: string): boolean {
  return HASH_RE.test(hash);
}

function validateRepoPath(repoPath: unknown): string | null {
  if (!repoPath || typeof repoPath !== 'string') return null;
  const resolved = path.resolve(repoPath);
  if (!fs.existsSync(resolved)) return null;
  if (ALLOWED_ROOTS.length > 0) {
    const allowed = ALLOWED_ROOTS.some(root => {
      const r = path.resolve(root);
      return resolved === r || resolved.startsWith(r + path.sep);
    });
    if (!allowed) return null;
  }
  return resolved;
}

// ==================== API 路由 ====================

/** GET /api/repo/info?path=xxx */
app.get('/api/repo/info', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  if (!repoPath) return res.status(400).json({ error: '请提供有效的仓库路径' });
  if (!isGitRepo(repoPath)) return res.status(400).json({ error: '不是有效的 Git 仓库' });

  res.json({
    path: repoPath,
    name: path.basename(repoPath),
    isValid: true
  });
});

/** GET /api/git/log?path=xxx&max=100&skip=0 */
app.get('/api/git/log', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  const maxCount = Math.min(parseInt(req.query.max as string) || 100, 500);
  const skip = Math.max(parseInt(req.query.skip as string) || 0, 0);
  if (!repoPath || !isGitRepo(repoPath)) {
    return res.status(400).json({ error: '无效的仓库路径' });
  }
  try {
    const commits = getCommitLog(repoPath, maxCount, skip);
    const branches = getBranches(repoPath);
    const tags = getTags(repoPath);
    const response: LogResponse = { commits, branches, tags };
    res.json(response);
  } catch (e: any) {
    logger.error('GET /api/git/log 失败', { err: e.message });
    res.status(500).json({ error: e.message, stderr: e.stderr || '' });
  }
});

/** GET /api/git/diff?path=xxx&hash=abc */
app.get('/api/git/diff', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  const { hash } = req.query;
  if (!repoPath || !hash) return res.status(400).json({ error: '缺少参数' });
  if (!validateHash(hash as string)) return res.status(400).json({ error: '无效的 hash 格式' });
  if (!isGitRepo(repoPath)) return res.status(400).json({ error: '无效的仓库路径' });
  try {
    const diff = getCommitDiff(repoPath, hash as string);
    res.json({ diff });
  } catch (e: any) {
    logger.error('GET /api/git/diff 失败', { err: e.message });
    res.status(500).json({ error: e.message, stderr: e.stderr || '' });
  }
});

/** GET /api/git/status?path=xxx */
app.get('/api/git/status', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  if (!repoPath || !isGitRepo(repoPath)) {
    return res.status(400).json({ error: '无效的仓库路径' });
  }
  try {
    const files = getStatus(repoPath);
    const currentBranch = getCurrentBranch(repoPath);
    const response: StatusResponse = { files, currentBranch };
    res.json(response);
  } catch (e: any) {
    logger.error('GET /api/git/status 失败', { err: e.message });
    res.status(500).json({ error: e.message, stderr: e.stderr || '' });
  }
});

// ==================== 暂存/提交操作 ====================

app.post('/api/git/stage', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { files } = req.body;
  if (!repoPath || !files?.length) return res.status(400).json({ error: '缺少参数' });
  try {
    const newStatus = stageFiles(repoPath, files);
    const response: StatusResponse = { files: newStatus, currentBranch: getCurrentBranch(repoPath) };
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/git/unstage', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { files } = req.body;
  if (!repoPath || !files?.length) return res.status(400).json({ error: '缺少参数' });
  try {
    const newStatus = unstageFiles(repoPath, files);
    const response: StatusResponse = { files: newStatus, currentBranch: getCurrentBranch(repoPath) };
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/git/discard', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { files } = req.body;
  if (!repoPath || !files?.length) return res.status(400).json({ error: '缺少参数' });
  try {
    const newStatus = discardFiles(repoPath, files);
    const response: StatusResponse = { files: newStatus, currentBranch: getCurrentBranch(repoPath) };
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/git/commit', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { message, all } = req.body;
  if (!repoPath || !message) return res.status(400).json({ error: '缺少参数' });
  try {
    const newStatus = commit(repoPath, message, !!all);
    const commits = getCommitLog(repoPath, 80);
    const branches = getBranches(repoPath);
    const response: ActionResponse = {
      files: newStatus, commits, branches, currentBranch: getCurrentBranch(repoPath)
    };
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 分支操作 ====================

app.post('/api/branch/create', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { name } = req.body;
  if (!repoPath || !name) return res.status(400).json({ error: '缺少参数' });
  try {
    const branches = createBranch(repoPath, name);
    res.json({ branches });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/branch/switch', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { name } = req.body;
  if (!repoPath || !name) return res.status(400).json({ error: '缺少参数' });
  try {
    const branches = switchBranch(repoPath, name);
    const commits = getCommitLog(repoPath, 80);
    const tags = getTags(repoPath);
    const files = getStatus(repoPath);
    const response: ActionResponse = { branches, commits, tags, files, currentBranch: getCurrentBranch(repoPath) };
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/branch/merge', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { name } = req.body;
  if (!repoPath || !name) return res.status(400).json({ error: '缺少参数' });
  try {
    const result = mergeBranch(repoPath, name);
    const commits = getCommitLog(repoPath, 80);
    const tags = getTags(repoPath);
    const response: ActionResponse = {
      ...result, commits, tags, currentBranch: getCurrentBranch(repoPath)
    };
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/branch/delete', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { name, force } = req.body;
  if (!repoPath || !name) return res.status(400).json({ error: '缺少参数' });
  try {
    const branches = deleteBranch(repoPath, name, force);
    res.json({ branches });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 远程操作 ====================

/** GET /api/git/unpushed-count?path=xxx — 获取领先远程的提交数 */
app.get('/api/git/unpushed-count', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  try {
    const count = getUnpushedCount(repoPath);
    res.json({ count });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/git/push — 推送到远程 */
app.post('/api/git/push', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { remote, branch, tags, force } = req.body;
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  try {
    const output = pushBranch(repoPath, remote || 'origin', branch, !!tags, !!force);
    const commits = getCommitLog(repoPath, 80);
    res.json({ output, commits, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 文件浏览与 Diff ====================

app.get('/api/git/tree', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  const hash = (req.query.hash as string) || 'HEAD';
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  if (hash !== 'HEAD' && !validateHash(hash)) return res.status(400).json({ error: '无效的 hash 格式' });
  try {
    const files = getFileTree(repoPath, hash || 'HEAD');
    res.json({ files });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/git/file', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  const hash = (req.query.hash as string) || 'HEAD';
  const { file } = req.query;
  if (!repoPath || !file) return res.status(400).json({ error: '缺少参数' });
  if (hash !== 'HEAD' && !validateHash(hash)) return res.status(400).json({ error: '无效的 hash 格式' });
  try {
    const content = getFileContent(repoPath, hash || 'HEAD', file as string);
    res.json({ content });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/git/diff-unstaged', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  try {
    const diff = getUnstagedDiff(repoPath);
    res.json({ diff });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/git/diff-staged', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  try {
    const diff = getStagedDiff(repoPath);
    res.json({ diff });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 静态文件服务 ====================
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'), err => {
      if (err) res.status(404).json({ message: '前端未构建，请先运行 npm run build 或通过 webpack-dev-server 访问' });
    });
  }
});

app.listen(PORT, () => {
  logger.info('Git 可视化服务已启动', { port: Number(PORT) });
  logger.info('API 端点就绪', { endpoint: `http://localhost:${PORT}/api` });
});

export default app;
