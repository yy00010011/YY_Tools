import React, { useState, useCallback, useEffect, useRef } from 'react';
import { API_BASE } from './config';
import { advancedApi } from './api';
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
import RemoteConfigModal from './components/RemoteConfigModal';
import PushCommitModal from './components/PushCommitModal';
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
  const [showRemoteConfig, setShowRemoteConfig] = useState(false);
  const [pushCommitTarget, setPushCommitTarget] = useState<RepoCommit | null>(null);
  const [checkoutConfirm, setCheckoutConfirm] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState<{ hash: string; hard: boolean } | null>(null);
  const [dropConfirm, setDropConfirm] = useState<string | null>(null);

  // 多标签页缓存
  const cacheRef = useRef<Record<string, RepoSnapshot>>({});

  /** 保存当前仓库状态到缓存 */
  const saveToCache = useCallback(() => {
    if (repoPath && repoInfo) {
      cacheRef.current[repoPath] = { repoPath, repoInfo, commits, branches, tags, unpushedCount };
    }
  }, [repoPath, repoInfo, commits, branches, tags, unpushedCount]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabs, repoPath],
  );

  // 连接成功后更新缓存和标签
  const prevRepoPathRef = useRef('');
  useEffect(() => {
    if (repoInfo && repoPath && repoPath !== prevRepoPathRef.current) {
      prevRepoPathRef.current = repoPath;
      // 直接构造快照，避免依赖整个 repo 对象导致每帧执行
      cacheRef.current[repoPath] = {
        repoPath,
        repoInfo,
        commits,
        branches,
        tags,
        unpushedCount,
      };
      setTabs((prev) => {
        const exists = prev.find((t) => t.path === repoPath);
        if (exists) return prev;
        const next = [...prev, { path: repoPath, label: repoInfo.name }];
        setActiveTabIndex(next.length - 1);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoInfo, repoPath]);

  /** 手动更新缓存 */
  const updateCache = useCallback(() => {
    if (repoPath && repoInfo) {
      cacheRef.current[repoPath] = { repoPath, repoInfo, commits, branches, tags, unpushedCount };
    }
  }, [repoPath, repoInfo, commits, branches, tags, unpushedCount]);

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
    [repoPath, activeTabIndex, handleConnect],
  );

  // ---- 委托给 useRepo 的操作 ----

  const handleBranchRefresh = useCallback(
    (data: { branches?: RepoBranch[]; commits?: RepoCommit[]; tags?: RepoTag[] }) => {
      repo.branchRefresh(data);
      setTimeout(updateCache, 100);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateCache],
  );

  const handleCommitRefresh = useCallback(
    (data: { commits?: RepoCommit[]; branches?: RepoBranch[] }) => {
      repo.commitRefresh(data);
      setTimeout(updateCache, 100);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateCache],
  );

  const handleLoadMore = useCallback(() => {
    repo.loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    [repoPath],
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
  }, [repoPath]);

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
  }, [repoPath]);

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
    [repoPath],
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
    [repoPath],
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
    [repoPath],
  );

  /** 推送指定提交到远程 */
  const handlePushCommit = useCallback(
    async (remote: string, branch: string, force: boolean) => {
      if (!pushCommitTarget) return;
      const hash = pushCommitTarget.hash;
      setPushCommitTarget(null);
      try {
        const data = await advancedApi.pushCommit(repoPath, hash, remote, branch, force);
        if (data.commits) setCommits(data.commits as RepoCommit[]);
        setError('');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [repoPath, pushCommitTarget, setCommits, setError],
  );

  /** 检出历史提交 */
  const handleCheckoutCommit = useCallback(
    async (hash: string) => {
      setCheckoutConfirm(null);
      setContextMenu(null);
      try {
        const data = await advancedApi.checkoutCommit(repoPath, hash);
        repo.commitRefresh(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [repoPath, repo],
  );

  /** 重置到指定提交 */
  const handleResetCommit = useCallback(
    async (hash: string, hard: boolean) => {
      setResetConfirm(null);
      setContextMenu(null);
      try {
        const data = await advancedApi.resetToCommit(repoPath, hash, hard);
        repo.commitRefresh(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [repoPath, repo],
  );

  /** 删除指定提交 */
  const handleDropCommit = useCallback(
    async (hash: string) => {
      setDropConfirm(null);
      setContextMenu(null);
      try {
        const data = await advancedApi.dropCommit(repoPath, hash);
        repo.commitRefresh(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [repoPath, repo],
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
            <button
              className="remote-config-btn"
              onClick={() => setShowRemoteConfig(true)}
              title="配置远程仓库地址"
            >
              🔗 远程
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
        {showRemoteConfig && (
          <RemoteConfigModal
            repoPath={repoPath}
            onClose={() => setShowRemoteConfig(false)}
            onRefresh={handleBranchRefresh}
          />
        )}
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
            <div className="context-menu-separator" />
            <div
              className="context-menu-item"
              onClick={() => {
                setPushCommitTarget(contextMenu.commit);
                setContextMenu(null);
              }}
            >
              📤 推送到远程
            </div>
            <div
              className="context-menu-item"
              onClick={() => {
                setCheckoutConfirm(contextMenu.commit.hash);
                setContextMenu(null);
              }}
            >
              📥 检出此版本
            </div>
            <div
              className="context-menu-item context-menu-item-danger"
              onClick={() => {
                setResetConfirm({ hash: contextMenu.commit.hash, hard: true });
                setContextMenu(null);
              }}
            >
              ⏪ 回退到此版本
            </div>
            <div
              className="context-menu-item context-menu-item-danger"
              onClick={() => {
                setDropConfirm(contextMenu.commit.hash);
                setContextMenu(null);
              }}
            >
              🗑 删除此提交
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
      {/* 推送提交到远程 */}
      {pushCommitTarget && (
        <PushCommitModal
          commitHash={pushCommitTarget.hash}
          shortHash={pushCommitTarget.shortHash || pushCommitTarget.hash.substring(0, 7)}
          remotes={[]}
          onConfirm={handlePushCommit}
          onCancel={() => setPushCommitTarget(null)}
        />
      )}
      {/* 检出历史提交确认 */}
      {checkoutConfirm && (
        <ConfirmModal
          title="检出历史版本"
          message={`确定要检出提交 ${checkoutConfirm.substring(0, 7)} 吗？\n\n此操作会切换到该提交（detached HEAD）。如需返回，可切换回原分支。`}
          confirmLabel="检出"
          onConfirm={() => handleCheckoutCommit(checkoutConfirm)}
          onCancel={() => setCheckoutConfirm(null)}
        />
      )}
      {/* 回退到历史提交确认 */}
      {resetConfirm && (
        <ConfirmModal
          title="⏪ 回退到此版本"
          message={`确定要回退到提交 ${resetConfirm.hash.substring(0, 7)} 吗？\n\n⚠️ 此操作将永久丢弃该提交之后的所有变更（git reset --hard）！\n请确保已备份重要数据。`}
          confirmLabel="确认回退"
          onConfirm={() => handleResetCommit(resetConfirm.hash, resetConfirm.hard)}
          onCancel={() => setResetConfirm(null)}
        />
      )}
      {/* 删除历史提交确认 */}
      {dropConfirm && (
        <ConfirmModal
          title="🗑 删除此提交"
          message={`确定要删除提交 ${dropConfirm.substring(0, 7)} 吗？\n\n⚠️ 此操作将从分支历史中移除该提交（git rebase --onto 跳过）。\n如果后续提交依赖此变更，可能产生冲突。冲突时可自动撤销。`}
          confirmLabel="确认删除"
          onConfirm={() => handleDropCommit(dropConfirm)}
          onCancel={() => setDropConfirm(null)}
        />
      )}
    </div>
  );
}
