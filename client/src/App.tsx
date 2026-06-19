import React, { useState, useCallback, useEffect, useRef } from 'react';
import { API_BASE } from './config';
import useRepo, { makeSnapshot, type RepoSnapshot, type RepoCommit, type RepoBranch, type RepoTag } from './hooks/useRepo';
import RepoInput from './components/RepoInput';
import BranchOps from './components/BranchOps';
import CommitGraph from './components/CommitGraph';
import CommitDetail from './components/CommitDetail';
import StageArea from './components/StageArea';
import PushModal from './components/PushModal';
import ConfirmModal from './components/ConfirmModal';
import ThemeToggle from './components/ThemeToggle';
import RebaseModal from './components/RebaseModal';
import RepoTabs from './components/RepoTabs';
import ErrorBoundary from './components/ErrorBoundary';

interface Tab {
  path: string;
  label: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  commit: { hash: string };
}

interface PushOptions {
  remote?: string;
  branch?: string;
  tags?: boolean;
  force?: boolean;
}

export default function App() {
  // ---- 核心仓库状态（由 useRepo hook 管理） ----
  const repo = useRepo('');
  const {
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
  } = repo;

  // ---- UI 专属状态 ----
  const [selectedCommit, setSelectedCommit] = useState<RepoCommit | null>(null);
  const [pushing, setPushing] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [showPullConfirm, setShowPullConfirm] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [cherryPickConfirm, setCherryPickConfirm] = useState<string | null>(null);
  const [revertConfirm, setRevertConfirm] = useState<string | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(-1);
  const [showRebaseModal, setShowRebaseModal] = useState(false);

  // 多标签页缓存
  const cacheRef = useRef<Record<string, RepoSnapshot>>({});

  /** 保存当前仓库状态到缓存 */
  const saveToCache = useCallback(() => {
    if (repoPath && repoInfo) {
      cacheRef.current[repoPath] = makeSnapshot(repo);
    }
  }, [repoPath, repoInfo, repo]);

  /** 连接仓库（首次加载）或从缓存恢复 */
  const handleConnect = useCallback(
    async (path: string, force = false) => {
      const cached = cacheRef.current[path];
      if (cached && !force) {
        repo.restore(cached);
        setSelectedCommit(null);
        const idx = tabs.findIndex((t) => t.path === path);
        if (idx >= 0) setActiveTabIndex(idx);
        return;
      }

      setSelectedCommit(null);
      await repo.connect(path);
    },
    [tabs, repo],
  );

  // 连接成功后更新缓存和标签
  const prevRepoPathRef = useRef('');
  useEffect(() => {
    if (repoInfo && repoPath && repoPath !== prevRepoPathRef.current) {
      prevRepoPathRef.current = repoPath;
      cacheRef.current[repoPath] = makeSnapshot(repo);
      setTabs((prev) => {
        const exists = prev.find((t) => t.path === repoPath);
        if (exists) return prev;
        const next = [...prev, { path: repoPath, label: repoInfo.name }];
        setActiveTabIndex(next.length - 1);
        return next;
      });
    }
  }, [repoInfo, repoPath, repo]);

  /** 手动更新缓存 */
  const updateCache = useCallback(() => {
    if (repoPath && repoInfo) {
      cacheRef.current[repoPath] = makeSnapshot(repo);
    }
  }, [repoPath, repoInfo, repo]);

  /** 切换到指定标签 */
  const handleTabSelect = useCallback(
    (index: number) => {
      const tab = tabs[index];
      if (!tab) return;
      if (tab.path === repoPath) return;

      saveToCache();
      handleConnect(tab.path);
    },
    [tabs, repoPath, saveToCache, handleConnect],
  );

  /** 关闭标签 */
  const handleTabClose = useCallback(
    (index: number) => {
      const closingPath = tabs[index]?.path;
      setTabs((prev) => {
        const next = [...prev];
        next.splice(index, 1);

        if (closingPath) delete cacheRef.current[closingPath];

        if (next.length === 0) {
          repo.restore({ repoPath: '', repoInfo: null, commits: [], branches: [], tags: [], unpushedCount: -1 });
          setActiveTabIndex(-1);
          cacheRef.current = {};
        } else if (closingPath === repoPath) {
          const newIdx = Math.min(index, next.length - 1);
          setActiveTabIndex(newIdx);
          const targetPath = next[newIdx]?.path;
          if (targetPath) handleConnect(targetPath);
        } else if (index < activeTabIndex) {
          setActiveTabIndex((prev) => prev - 1);
        }
        return next;
      });
    },
    [repoPath, activeTabIndex, handleConnect, repo],
  );

  // ---- 委托给 useRepo 的操作 ----

  const handleBranchRefresh = useCallback(
    (data: { branches?: RepoBranch[]; commits?: RepoCommit[]; tags?: RepoTag[] }) => {
      repo.branchRefresh(data);
      setTimeout(updateCache, 100);
    },
    [repo, updateCache],
  );

  const handleCommitRefresh = useCallback(
    (data: { commits?: RepoCommit[]; branches?: RepoBranch[] }) => {
      repo.commitRefresh(data);
      setTimeout(updateCache, 100);
    },
    [repo, updateCache],
  );

  const handleLoadMore = useCallback(() => {
    repo.loadMore();
  }, [repo]);

  // ---- 提交操作 ----

  const handleCommitClick = useCallback(
    (commit: { hash: string }) => {
      setSelectedCommit(selectedCommit?.hash === commit.hash ? null : commit);
    },
    [selectedCommit],
  );

  // ---- 远程操作 ----

  const handlePush = useCallback(
    async (options: PushOptions = {}) => {
      setShowPushModal(false);
      setPushing(true);
      try {
        const res = await fetch(`${API_BASE}/git/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: repoPath, ...options }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (data.commits) setCommits(data.commits as RepoCommit[]);
        repo.branchRefresh({ commits: data.commits as RepoCommit[] });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPushing(false);
      }
    },
    [repoPath, repo, setCommits, setError],
  );

  const handleFetch = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`${API_BASE}/git/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repoPath }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.commits) setCommits(data.commits as RepoCommit[]);
      if (data.branches) setBranches(data.branches as RepoBranch[]);
      repo.branchRefresh(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetching(false);
    }
  }, [repoPath, repo, setCommits, setBranches, setError]);

  const handlePull = useCallback(async () => {
    setShowPullConfirm(false);
    setPulling(true);
    try {
      const res = await fetch(`${API_BASE}/git/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repoPath }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.commits) setCommits(data.commits as RepoCommit[]);
      if (data.branches) setBranches(data.branches as RepoBranch[]);
      repo.branchRefresh(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPulling(false);
    }
  }, [repoPath, repo, setCommits, setBranches, setError]);

  // ---- 高级操作 ----

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, commit: { hash: string }) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, commit });
    },
    [],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleCherryPick = useCallback(
    async (hash: string) => {
      setCherryPickConfirm(null);
      setContextMenu(null);
      try {
        const res = await fetch(`${API_BASE}/git/cherry-pick`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: repoPath, hash }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        repo.commitRefresh(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [repoPath, repo, setError],
  );

  const handleRevert = useCallback(
    async (hash: string) => {
      setRevertConfirm(null);
      setContextMenu(null);
      try {
        const res = await fetch(`${API_BASE}/git/revert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: repoPath, hash }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        repo.commitRefresh(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [repoPath, repo, setError],
  );

  const handleRebase = useCallback(
    async (onto: string) => {
      setShowRebaseModal(false);
      try {
        const res = await fetch(`${API_BASE}/git/rebase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: repoPath, onto }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        repo.commitRefresh(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [repoPath, repo, setError],
  );

  /** 全局键盘快捷键 */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape') {
        setSelectedCommit(null);
      } else if (mod && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('.path-input');
        if (input) input.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ==================== 渲染 ====================

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔀 Git 可视化工具</h1>
        <RepoInput onConnect={handleConnect} loading={loading} />
        <RepoTabs
          tabs={tabs}
          activeIndex={activeTabIndex}
          onSelect={handleTabSelect}
          onClose={handleTabClose}
        />
        <ThemeToggle />
        {repoInfo && (
          <>
            <span className="repo-badge">📁 {repoInfo.name}</span>
            <button
              className="fetch-btn"
              onClick={handleFetch}
              disabled={fetching}
              title="从远程获取更新"
            >
              {fetching ? '⏳' : '⬇'} 获取
            </button>
            <button
              className="pull-btn"
              onClick={() => setShowPullConfirm(true)}
              disabled={pulling}
              title="拉取并合并远程变更"
            >
              {pulling ? '⏳' : '🔃'} 拉取
            </button>
            <button
              className="rebase-btn"
              onClick={() => setShowRebaseModal(true)}
              title="Rebase 当前分支到其他分支"
            >
              🔀 Rebase
            </button>
          </>
        )}
        {unpushedCount > 0 && (
          <button
            className="push-btn"
            onClick={() => setShowPushModal(true)}
            disabled={pushing}
            title={`${unpushedCount} 个未推送的提交`}
          >
            {pushing ? '⏳ 推送中...' : `📤 推送 (${unpushedCount})`}
          </button>
        )}
        {showPushModal && React.createElement(PushModal as any, {
            branches,
            currentBranch: branches.find((b) => b.isHead)?.name || '',
            onConfirm: handlePush,
            onCancel: () => setShowPushModal(false),
          })}
        {showRebaseModal && React.createElement(RebaseModal as any, {
            branches,
            currentBranch: branches.find((b) => b.isHead)?.name || '',
            repoPath,
            onConfirm: handleRebase,
            onCancel: () => setShowRebaseModal(false),
          })}
      </header>

      {error && <div className="error-banner">❌ {error}</div>}

      {repoInfo ? (
        <ErrorBoundary>
          <div className="main-layout">
            <aside className="sidebar">
              <BranchOps
                branches={branches}
                tags={tags}
                repoPath={repoPath}
                onRefresh={handleBranchRefresh}
              />
            </aside>

            <div className="content-wrapper">
              <main className="content">
                {React.createElement(CommitGraph as any, {
                  commits,
                  branches,
                  tags,
                  selectedCommit,
                  onCommitClick: handleCommitClick,
                  onContextMenu: handleContextMenu,
                  loadingMore,
                  onLoadMore: handleLoadMore,
                })}
              </main>
              <StageArea repoPath={repoPath} onRefresh={handleCommitRefresh} />
            </div>

            {selectedCommit && (
              <aside className="detail-panel">
                <CommitDetail commit={selectedCommit} repoPath={repoPath} />
              </aside>
            )}
          </div>
        </ErrorBoundary>
      ) : (
        <div className="welcome">
          <div className="welcome-icon">🔍</div>
          <h2>打开一个 Git 仓库开始探索</h2>
          <p>输入本地 Git 仓库的路径，查看提交历史和分支关系</p>
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div className="context-overlay" onClick={closeContextMenu} />
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <div
              className="context-menu-item"
              onClick={() => setCherryPickConfirm(contextMenu.commit.hash)}
            >
              🍒 Cherry-Pick
            </div>
            <div
              className="context-menu-item"
              onClick={() => setRevertConfirm(contextMenu.commit.hash)}
            >
              ↩ Revert
            </div>
          </div>
        </>
      )}

      {/* 确认对话框 */}
      {showPullConfirm && (
        <ConfirmModal
          title="拉取远程变更"
          message="确定要从远程仓库拉取并合并变更吗？如有冲突需要手动解决。"
          confirmLabel="确认拉取"
          onConfirm={handlePull}
          onCancel={() => setShowPullConfirm(false)}
        />
      )}
      {cherryPickConfirm && (
        <ConfirmModal
          title="Cherry-Pick"
          message={`确定要将提交 ${cherryPickConfirm.substring(0, 7)} Cherry-pick 到当前分支吗？`}
          confirmLabel="Cherry-Pick"
          onConfirm={() => handleCherryPick(cherryPickConfirm)}
          onCancel={() => setCherryPickConfirm(null)}
        />
      )}
      {revertConfirm && (
        <ConfirmModal
          title="Revert"
          message={`确定要 Revert 提交 ${revertConfirm.substring(0, 7)} 吗？这将创建一个新的反向提交。`}
          confirmLabel="Revert"
          onConfirm={() => handleRevert(revertConfirm)}
          onCancel={() => setRevertConfirm(null)}
        />
      )}
    </div>
  );
}
