/**
 * 提交日志 / Diff / Blame / 文件历史 路由
 */
import { Router, Request, Response } from 'express';
import {
  isGitRepo,
  getCommitLog,
  getBranches,
  getTags,
  getCommitDiff,
  getBlame,
  getFileLog,
} from '../gitService';
import { validateRepoPath, validateHash, validateFileName } from '../validators';
import logger from '../logger';
import type { LogResponse } from '../types';

const router = Router();

/** GET /api/git/log?path=xxx&max=100&skip=0 */
router.get('/git/log', (req: Request, res: Response) => {
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
router.get('/git/diff', (req: Request, res: Response) => {
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

/** GET /api/git/blame?path=xxx&file=xxx&hash=HEAD */
router.get('/git/blame', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  const file = req.query.file as string;
  const hash = (req.query.hash as string) || 'HEAD';
  if (!repoPath || !file) return res.status(400).json({ error: '缺少参数' });
  if (!validateFileName(file)) return res.status(400).json({ error: '无效的文件名' });
  if (hash !== 'HEAD' && !validateHash(hash)) return res.status(400).json({ error: '无效的 hash 格式' });
  try {
    const lines = getBlame(repoPath, file, hash);
    res.json({ lines });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/git/file-log?path=xxx&file=xxx&max=50 */
router.get('/git/file-log', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  const file = req.query.file as string;
  const maxCount = Math.min(parseInt(req.query.max as string) || 50, 200);
  if (!repoPath || !file) return res.status(400).json({ error: '缺少参数' });
  if (!validateFileName(file)) return res.status(400).json({ error: '无效的文件名' });
  try {
    const commits = getFileLog(repoPath, file, maxCount);
    res.json({ commits });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
