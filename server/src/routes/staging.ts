/**
 * 暂存区 / 提交 路由
 */
import { Router, Request, Response } from 'express';
import {
  getStatus,
  getCurrentBranch,
  stageFiles,
  unstageFiles,
  discardFiles,
  commit,
  getCommitLog,
  getBranches,
} from '../gitService';
import {
  validateRepoPath,
  validateFileList,
  validateCommitMessage,
} from '../validators';
import logger from '../logger';
import type { StatusResponse, ActionResponse } from '../types';

const router = Router();

/** GET /api/git/status?path=xxx */
router.get('/git/status', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
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

router.post('/git/stage', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { files } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!validateFileList(files)) return res.status(400).json({ error: '请提供有效的文件列表' });
  try {
    const newStatus = stageFiles(repoPath, files);
    const response: StatusResponse = { files: newStatus, currentBranch: getCurrentBranch(repoPath) };
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/git/unstage', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { files } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!validateFileList(files)) return res.status(400).json({ error: '请提供有效的文件列表' });
  try {
    const newStatus = unstageFiles(repoPath, files);
    const response: StatusResponse = { files: newStatus, currentBranch: getCurrentBranch(repoPath) };
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/git/discard', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { files } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!validateFileList(files)) return res.status(400).json({ error: '请提供有效的文件列表' });
  try {
    const newStatus = discardFiles(repoPath, files);
    const response: StatusResponse = { files: newStatus, currentBranch: getCurrentBranch(repoPath) };
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/git/commit', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { message, all } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!validateCommitMessage(message)) return res.status(400).json({ error: '请提供有效的提交信息（1-10240字符）' });
  try {
    const newStatus = commit(repoPath, message, !!all);
    const commits = getCommitLog(repoPath, 80);
    const branches = getBranches(repoPath);
    const response: ActionResponse = {
      files: newStatus,
      commits,
      branches,
      currentBranch: getCurrentBranch(repoPath),
    };
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
