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

export default router;
