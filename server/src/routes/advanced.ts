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
  pushCommit,
  checkoutCommit,
  resetToCommit,
  dropCommit,
} from '../gitService';
import {
  validateRepoPath,
  validateHash,
  validateRefName,
  validateRemoteName,
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

// ==================== 提交推送 & 版本切换 ====================

/** POST /api/git/push-commit — 将指定提交推送到远程分支 */
router.post('/git/push-commit', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { hash, remote, branch, force } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!hash || !validateHash(hash)) return res.status(400).json({ error: '无效的提交 hash' });
  if (!remote || !validateRemoteName(remote)) return res.status(400).json({ error: '请提供有效的远程名称' });
  if (!branch || !validateRefName(branch)) return res.status(400).json({ error: '请提供有效的目标分支名' });
  try {
    const output = pushCommit(repoPath, hash, remote, branch, !!force);
    res.json({ output, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/git/checkout-commit — 检出历史提交（detached HEAD） */
router.post('/git/checkout-commit', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { hash } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!hash || !validateHash(hash)) return res.status(400).json({ error: '无效的提交 hash' });
  try {
    const output = checkoutCommit(repoPath, hash);
    const commits = getCommitLog(repoPath, 80);
    res.json({ output, commits, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/git/reset-commit — 重置当前分支到指定提交 */
router.post('/git/reset-commit', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { hash, hard } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!hash || !validateHash(hash)) return res.status(400).json({ error: '无效的提交 hash' });
  try {
    const output = resetToCommit(repoPath, hash, !!hard);
    const commits = getCommitLog(repoPath, 80);
    const branches = getCommitLog(repoPath, 1); // 触发刷新
    res.json({ output, commits, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/git/drop-commit — 删除某个历史提交（rebase --onto 跳过） */
router.post('/git/drop-commit', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { hash } = req.body;
  if (!repoPath) return res.status(400).json({ error: '无效的仓库路径' });
  if (!hash || !validateHash(hash)) return res.status(400).json({ error: '无效的提交 hash' });
  try {
    const output = dropCommit(repoPath, hash);
    const commits = getCommitLog(repoPath, 80);
    res.json({ output, commits, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
