/**
 * 仓库信息 & 健康检查 路由
 */
import { Router, Request, Response } from 'express';
import path from 'path';
import { isGitRepo } from '../gitService';
import { validateRepoPath } from '../validators';

const router = Router();

/** GET /api/health */
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

/** GET /api/repo/info?path=xxx */
router.get('/repo/info', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  if (!repoPath) return res.status(400).json({ error: '请提供有效的仓库路径' });
  if (!isGitRepo(repoPath)) return res.status(400).json({ error: '不是有效的 Git 仓库' });

  res.json({
    path: repoPath,
    name: path.basename(repoPath),
    isValid: true,
  });
});

export default router;
