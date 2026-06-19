/**
 * 高级 Git 操作路由 — compare / cherry-pick / revert / rebase
 */
import { Router, Request, Response } from 'express';
import {
  getCommitLog,
  getCurrentBranch,
  compareBranches,
  cherryPickCommit,
  revertCommit,
  rebaseBranch,
  rebaseAbort,
  rebaseContinue,
} from '../gitService';
import {
  validateRepoPath,
  validateHash,
  validateRefName,
} from '../validators';

const router = Router();

/** GET /api/git/compare?path=xxx&base=xxx&compare=xxx */
router.get('/git/compare', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  const base = req.query.base as string;
  const compare = req.query.compare as string;
  if (!repoPath || !base || !compare) return res.status(400).json({ error: '缺少参数' });
  try {
    const diff = compareBranches(repoPath, base, compare);
    res.json({ diff });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/git/cherry-pick */
router.post('/git/cherry-pick', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { hash } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!hash || !validateHash(hash)) return res.status(400).json({ error: '无效的提交 hash' });
  try {
    const output = cherryPickCommit(repoPath, hash);
    const commits = getCommitLog(repoPath, 80);
    res.json({ output, commits, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/git/revert */
router.post('/git/revert', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { hash } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!hash || !validateHash(hash)) return res.status(400).json({ error: '无效的提交 hash' });
  try {
    const output = revertCommit(repoPath, hash);
    const commits = getCommitLog(repoPath, 80);
    res.json({ output, commits, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/git/rebase */
router.post('/git/rebase', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { onto } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!validateRefName(onto)) return res.status(400).json({ error: '请提供有效的目标分支名' });
  try {
    const output = rebaseBranch(repoPath, onto);
    const commits = getCommitLog(repoPath, 80);
    res.json({ output, commits, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/git/rebase-abort */
router.post('/git/rebase-abort', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  try {
    const output = rebaseAbort(repoPath);
    const commits = getCommitLog(repoPath, 80);
    res.json({ output, commits, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/git/rebase-continue */
router.post('/git/rebase-continue', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  try {
    const output = rebaseContinue(repoPath);
    const commits = getCommitLog(repoPath, 80);
    res.json({ output, commits, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
