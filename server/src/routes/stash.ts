/**
 * Stash 操作路由
 */
import { Router, Request, Response } from 'express';
import {
  getStatus,
  getCurrentBranch,
  stashList,
  stashPush,
  stashPop,
  stashApply,
  stashDrop,
} from '../gitService';
import { validateRepoPath } from '../validators';

function validateStashIndex(index: unknown): index is number {
  if (index === undefined || index === null) return true; // 可选
  return typeof index === 'number' && Number.isInteger(index) && index >= 0;
}

const router = Router();

router.get('/git/stash-list', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  try {
    const list = stashList(repoPath);
    res.json({ list });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/git/stash-push', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { message } = req.body;
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  try {
    const list = stashPush(repoPath, message);
    const files = getStatus(repoPath);
    res.json({ list, files, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/git/stash-pop', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { index } = req.body;
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  if (!validateStashIndex(index)) return res.status(400).json({ error: '无效的 stash 索引' });
  try {
    const list = stashPop(repoPath, index);
    const files = getStatus(repoPath);
    res.json({ list, files, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/git/stash-apply', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { index } = req.body;
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  if (!validateStashIndex(index)) return res.status(400).json({ error: '无效的 stash 索引' });
  try {
    const list = stashApply(repoPath, index);
    const files = getStatus(repoPath);
    res.json({ list, files, currentBranch: getCurrentBranch(repoPath) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/git/stash-drop', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.body.path);
  const { index } = req.body;
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  if (!validateStashIndex(index)) return res.status(400).json({ error: '无效的 stash 索引' });
  try {
    const list = stashDrop(repoPath, index);
    res.json({ list });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
