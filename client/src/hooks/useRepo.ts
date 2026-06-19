import { useState, useCallback, useEffect, useRef } from 'react';
import { API_BASE, PAGE_SIZE } from '../config';
import { repoApi, commitApi, remoteApi } from '../api';

// ---- 仓库状态类型 ----
export interface RepoBranch {
  name: string;
  hash?: string;
  isHead?: boolean;
}

export interface RepoCommit {
  hash: string;
  shortHash?: string;
  subject?: string;
  parents?: string[];
  refs?: { branches?: string[]; tags?: string[]; isHead?: boolean };
  _lane?: number;
  _color?: string;
}

export interface RepoTag {
  name: string;
  hash?: string;
}

export interface RepoSnapshot {
  repoPath: string;
  repoInfo: { path: string; name: string; isValid: boolean } | null;
  commits: RepoCommit[];
  branches: RepoBranch[];
  tags: RepoTag[];
  unpushedCount: number;
}

type RefreshData = {
  branches?: RepoBranch[];
  commits?: RepoCommit[];
  tags?: RepoTag[];
};

export function makeSnapshot(state: {
  repoPath: string;
  repoInfo: RepoSnapshot['repoInfo'];
  commits: RepoCommit[];
  branches: RepoBranch[];
  tags: RepoTag[];
  unpushedCount: number;
}): RepoSnapshot {
  return {
    repoPath: state.repoPath,
    repoInfo: state.repoInfo,
    commits: state.commits,
    branches: state.branches,
    tags: state.tags,
    unpushedCount: state.unpushedCount,
  };
}

/**
 * 单个仓库状态管理 hook
 * 封装连接、日志加载、分支刷新等逻辑
 */
export default function useRepo(initialPath: string) {
  const [repoPath, setRepoPath] = useState(initialPath || '');
  const [repoInfo, setRepoInfo] = useState<RepoSnapshot['repoInfo']>(null);
  const [commits, setCommits] = useState<RepoCommit[]>([]);
  const [branches, setBranches] = useState<RepoBranch[]>([]);
  const [tags, setTags] = useState<RepoTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [unpushedCount, setUnpushedCount] = useState(-1);
  const pathRef = useRef(repoPath);
  const commitsRef = useRef<RepoCommit[]>(commits);
  const loadingMoreRef = useRef(false);

  useEffect(() => { pathRef.current = repoPath; }, [repoPath]);
  useEffect(() => { commitsRef.current = commits; }, [commits]);

  /** 从缓存快照恢复（不触发网络请求） */
  const restore = useCallback((snapshot: Partial<RepoSnapshot> | null) => {
    if (!snapshot) return;
    setRepoPath(snapshot.repoPath || '');
    setRepoInfo(snapshot.repoInfo || null);
    setCommits((snapshot.commits || []) as RepoCommit[]);
    setBranches((snapshot.branches || []) as RepoBranch[]);
    setTags((snapshot.tags || []) as RepoTag[]);
    setUnpushedCount(snapshot.unpushedCount ?? -1);
    setError('');
  }, []);

  /** 连接仓库 */
  const connect = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const infoData = await repoApi.info(path);
      setRepoInfo(infoData);
      setRepoPath(path);

      const logData = await commitApi.log(path, PAGE_SIZE);

      setCommits(logData.commits || []);
      setBranches(logData.branches || []);
      setTags(logData.tags || []);

      try {
        const countData = await remoteApi.unpushedCount(path);
        setUnpushedCount(countData.count ?? -1);
      } catch {
        setUnpushedCount(-1);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setRepoInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 加载更多 */
  const loadMore = useCallback(async () => {
    const p = pathRef.current;
    if (!p || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const currentLen = commitsRef.current.length;
      const data = await commitApi.log(p, PAGE_SIZE, currentLen);
      if (data.error) throw new Error(data.error);
      const newCommits = data.commits || [];
      if (newCommits.length > 0) {
        setCommits((prev) => [...prev, ...newCommits]);
      }
    } catch (err: unknown) {
      console.error('加载更多失败:', err instanceof Error ? err.message : err);
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, []);

  /** 分支操作刷新 */
  const branchRefresh = useCallback((data: RefreshData) => {
    if (data.branches) setBranches(data.branches);
    if (data.commits) setCommits(data.commits);
    if (data.tags) setTags(data.tags);
    const p = pathRef.current;
    remoteApi.unpushedCount(p)
      .then((d) => setUnpushedCount(d.count ?? -1))
      .catch(() => {});
  }, []);

  /** 提交操作刷新 */
  const commitRefresh = useCallback((data: RefreshData) => {
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
    restore,
    loadMore,
    branchRefresh,
    commitRefresh,
  };
}
