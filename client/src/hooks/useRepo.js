import { useState, useCallback, useEffect, useRef } from 'react';
import { API_BASE, PAGE_SIZE } from '../config';

/**
 * 单个仓库状态管理 hook
 * 封装连接、日志加载、分支刷新等逻辑
 */
export default function useRepo(initialPath) {
  const [repoPath, setRepoPath] = useState(initialPath || '');
  const [repoInfo, setRepoInfo] = useState(null);
  const [commits, setCommits] = useState([]);
  const [branches, setBranches] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [unpushedCount, setUnpushedCount] = useState(-1);
  const pathRef = useRef(repoPath);

  useEffect(() => { pathRef.current = repoPath; }, [repoPath]);

  /** 连接仓库 */
  const connect = useCallback(async (path) => {
    setLoading(true);
    setError('');
    try {
      const infoRes = await fetch(`${API_BASE}/repo/info?path=${encodeURIComponent(path)}`);
      const infoData = await infoRes.json();
      if (infoData.error) throw new Error(infoData.error);

      setRepoInfo(infoData);
      setRepoPath(path);

      const logRes = await fetch(`${API_BASE}/git/log?path=${encodeURIComponent(path)}&max=${PAGE_SIZE}`);
      const logData = await logRes.json();
      if (logData.error) throw new Error(logData.error);

      setCommits(logData.commits || []);
      setBranches(logData.branches || []);
      setTags(logData.tags || []);

      try {
        const countRes = await fetch(`${API_BASE}/git/unpushed-count?path=${encodeURIComponent(path)}`);
        const countData = await countRes.json();
        setUnpushedCount(countData.count ?? -1);
      } catch { setUnpushedCount(-1); }
    } catch (err) {
      setError(err.message);
      setRepoInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 加载更多 */
  const loadMore = useCallback(async () => {
    const p = pathRef.current;
    if (!p || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${API_BASE}/git/log?path=${encodeURIComponent(p)}&max=${PAGE_SIZE}&skip=${commits.length}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const newCommits = data.commits || [];
      if (newCommits.length > 0) {
        setCommits(prev => [...prev, ...newCommits]);
      }
    } catch (err) {
      console.error('加载更多失败:', err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [commits.length, loadingMore]);

  /** 分支操作刷新 */
  const branchRefresh = useCallback((data) => {
    if (data.branches) setBranches(data.branches);
    if (data.commits) setCommits(data.commits);
    if (data.tags) setTags(data.tags);
    const p = pathRef.current;
    fetch(`${API_BASE}/git/unpushed-count?path=${encodeURIComponent(p)}`)
      .then(r => r.json()).then(d => setUnpushedCount(d.count ?? -1)).catch(() => {});
  }, []);

  /** 提交操作刷新 */
  const commitRefresh = useCallback((data) => {
    if (data.commits) setCommits(data.commits);
    if (data.branches) setBranches(data.branches);
  }, []);

  return {
    repoPath,
    repoInfo,
    commits,
    branches,
    tags,
    loading,
    error,
    loadingMore,
    unpushedCount,
    setError,
    setCommits,
    setBranches,
    setTags,
    setUnpushedCount,
    connect,
    loadMore,
    branchRefresh,
    commitRefresh,
  };
}
