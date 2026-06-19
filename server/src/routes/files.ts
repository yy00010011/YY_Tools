/**
 * 文件浏览 & Diff 路由
 */
import { Router, Request, Response } from 'express';
import {
  getFileTree,
  getFileContent,
  getUnstagedDiff,
  getStagedDiff,
} from '../gitService';
import { validateRepoPath, validateHash } from '../validators';

const router = Router();

/** GET /api/git/tree?path=xxx&hash=HEAD */
router.get('/git/tree', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  const hash = (req.query.hash as string) || 'HEAD';
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  if (hash !== 'HEAD' && !validateHash(hash)) return res.status(400).json({ error: '无效的 hash 格式' });
  try {
    const files = getFileTree(repoPath, hash);
    res.json({ files });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/git/file?path=xxx&hash=HEAD&file=xxx */
router.get('/git/file', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  const hash = (req.query.hash as string) || 'HEAD';
  const { file } = req.query;
  if (!repoPath || !file) return res.status(400).json({ error: '缺少参数' });
  if (hash !== 'HEAD' && !validateHash(hash)) return res.status(400).json({ error: '无效的 hash 格式' });
  try {
    const content = getFileContent(repoPath, hash, file as string);
    res.json({ content });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/git/diff-unstaged?path=xxx */
router.get('/git/diff-unstaged', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  try {
    const diff = getUnstagedDiff(repoPath);
    res.json({ diff });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/git/diff-staged?path=xxx */
router.get('/git/diff-staged', (req: Request, res: Response) => {
  const repoPath = validateRepoPath(req.query.path);
  if (!repoPath) return res.status(400).json({ error: '缺少仓库路径' });
  try {
    const diff = getStagedDiff(repoPath);
    res.json({ diff });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
