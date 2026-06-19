/**
 * 分支 & 标签 路由
 */
import { Router, Request, Response } from 'express';
import {
  getBranches,
  getTags,
  getStatus,
  getCurrentBranch,
  getCommitLog,
  createBranch,
  switchBranch,
  mergeBranch,
  deleteBranch,
  checkoutRemoteBranch,
  deleteRemoteBranch,
  createTag,
  deleteTag,
} from '../gitService';
import {
  validateRepoPath,
  validateRefName,
  validateRemoteName,
  validateHash,
} from '../validators';
import type { ActionResponse } from '../types';

const router = Router();

// ==================== 分支操作 ====================

router.post('/branch/create', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { name } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!validateRefName(name)) return res.status(400).json({ error: '请提供有效的分支名称' });
  try {
    const branches = createBranch(repoPath, name);
    res.json({ branches });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/branch/switch', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { name } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!validateRefName(name)) return res.status(400).json({ error: '请提供有效的分支名称' });
  try {
    const branches = switchBranch(repoPath, name);
    const commits = getCommitLog(repoPath, 80);
    const tags = getTags(repoPath);
    const files = getStatus(repoPath);
    const response: ActionResponse = {
      branches, commits, tags, files, currentBranch: getCurrentBranch(repoPath),
    };
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/branch/merge', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { name } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!validateRefName(name)) return res.status(400).json({ error: '请提供有效的分支名称' });
  try {
    const result = mergeBranch(repoPath, name);
    const commits = getCommitLog(repoPath, 80);
    const tags = getTags(repoPath);
    const response: ActionResponse = {
      ...result, commits, tags, currentBranch: getCurrentBranch(repoPath),
    };
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/branch/delete', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { name, force } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!validateRefName(name)) return res.status(400).json({ error: '请提供有效的分支名称' });
  try {
    const branches = deleteBranch(repoPath, name, !!force);
    res.json({ branches });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/branch/checkout-remote', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { remoteBranch } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!validateRefName(remoteBranch)) return res.status(400).json({ error: '请提供有效的远程分支名' });
  try {
    const branches = checkoutRemoteBranch(repoPath, remoteBranch);
    const commits = getCommitLog(repoPath, 80);
    res.json({ branches, commits, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/branch/delete-remote', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { remote, branch } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!validateRemoteName(remote)) return res.status(400).json({ error: '请提供有效的远程名称' });
  if (!validateRefName(branch)) return res.status(400).json({ error: '请提供有效的分支名称' });
  try {
    const branches = deleteRemoteBranch(repoPath, remote, branch);
    res.json({ branches });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 标签操作 ====================

router.post('/tag/create', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { name, commit } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!validateRefName(name)) return res.status(400).json({ error: '请提供有效的标签名称' });
  if (commit !== undefined && (!validateHash(commit) || typeof commit !== 'string')) {
    return res.status(400).json({ error: '无效的提交 hash' });
  }
  try {
    const tags = createTag(repoPath, name, commit);
    res.json({ tags });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tag/delete', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { name } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!validateRefName(name)) return res.status(400).json({ error: '请提供有效的标签名称' });
  try {
    const tags = deleteTag(repoPath, name);
    res.json({ tags });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
