/**
 * 远程操作路由 — push / fetch / pull / unpushed-count
 */
import { Router, Request, Response } from 'express';
import {
  getCommitLog,
  getCurrentBranch,
  getUnpushedCount,
  pushBranch,
  fetchRemote,
  pullBranch,
  getRemotes,
  addRemote,
} from '../gitService';
import { validateRepoPath, validateRemoteName, validateRefName } from '../validators';

const router = Router();

/** GET /api/git/unpushed-count?path=xxx */
router.get('/git/unpushed-count', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  try {
    const count = getUnpushedCount(repoPath);
    res.json({ count });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/git/push */
router.post('/git/push', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { remote, branch, tags, force } = req.body;
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  if (remote && !validateRemoteName(remote)) return res.status(400).json({ error: '无效的远程名称' });
  if (branch && !validateRefName(branch)) return res.status(400).json({ error: '无效的分支名称' });
  try {
    const output = pushBranch(repoPath, remote || 'origin', branch, !!tags, !!force);
    const commits = getCommitLog(repoPath, 80);
    res.json({ output, commits, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/git/fetch */
router.post('/git/fetch', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { remote } = req.body;
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  if (remote && !validateRemoteName(remote)) return res.status(400).json({ error: '无效的远程名称' });
  try {
    const output = fetchRemote(repoPath, remote || 'origin');
    const commits = getCommitLog(repoPath, 80);
    res.json({ output, commits, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/git/pull */
router.post('/git/pull', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { remote, branch } = req.body;
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  if (remote && !validateRemoteName(remote)) return res.status(400).json({ error: '无效的远程名称' });
  if (branch && !validateRefName(branch)) return res.status(400).json({ error: '无效的分支名称' });
  try {
    const output = pullBranch(repoPath, remote || 'origin', branch);
    const commits = getCommitLog(repoPath, 80);
    res.json({ output, commits, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 远程仓库管理 ====================

/** GET /api/remote/list?path=xxx — 获取远程仓库列表 */
router.get('/remote/list', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  try {
    const remotes = getRemotes(repoPath);
    res.json({ remotes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/remote/add — 添加或更新远程仓库 */
router.post('/remote/add', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { name, url } = req.body;
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  if (!name || typeof name !== 'string') return res.status(400).json({ error: '请提供远程仓库名称' });
  if (!url || typeof url !== 'string') return res.status(400).json({ error: '请提供远程仓库地址' });
  // 简单校验：URL 应该是 git@... 或 https://... 格式
  if (!/^(https?:\/\/|git@|ssh:\/\/)/.test(url)) {
    return res.status(400).json({ error: '请提供有效的 Git 远程地址（如 https://github.com/user/repo.git 或 git@github.com:user/repo.git）' });
  }
  try {
    const message = addRemote(repoPath, name, url);
    const remotes = getRemotes(repoPath);
    res.json({ message, remotes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
