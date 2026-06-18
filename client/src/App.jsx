import React, { useState, useCallback, useEffect, useRef } from 'react';
import { API_BASE, PAGE_SIZE } from './config';
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

export default function App() {
  const [repoPath, setRepoPath] = useState('');
  const [repoInfo, setRepoInfo] = useState(null);
  const [commits, setCommits] = useState([]);
  const [branches, setBranches] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [unpushedCount, setUnpushedCount] = useState(-1);
  const [pushing, setPushing] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [showPullConfirm, setShowPullConfirm] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, commit }
  const [cherryPickConfirm, setCherryPickConfirm] = useState(null);
  const [revertConfirm, setRevertConfirm] = useState(null);
  const [tabs, setTabs] = useState([]);
  const [activeTabIndex, setActiveTabIndex] = useState(-1);
  const [showRebaseModal, setShowRebaseModal] = useState(false);
  const cacheRef = useRef({}); // { [path]: { repoInfo, commits, branches, tags, unpushedCount } }

  /** 连接仓库（首次加载）或从缓存恢复 */
  const handleConnect = useCallback(async (path, force = false) => {
    // 从缓存恢复
    const cached = cacheRef.current[path];
    if (cached && !force) {
      setRepoPath(path);
      setRepoInfo(cached.repoInfo);
      setCommits(cached.commits);
      setBranches(cached.branches);
      setTags(cached.tags);
      setUnpushedCount(cached.unpushedCount ?? -1);
      setError('');
      setSelectedCommit(null);
      const idx = tabs.findIndex(t => t.path === path);
      if (idx >= 0) setActiveTabIndex(idx);
      return;
    }

    // 首次数加载
    setLoading(true);
    setError('');
    setSelectedCommit(null);
    try {
      const infoRes = await fetch(`${API_BASE}/repo/info?path=${encodeURIComponent(path)}`);
      const infoData = await infoRes.json();
      if (infoData.error) throw new Error(infoData.error);

      const logRes = await fetch(`${API_BASE}/git/log?path=${encodeURIComponent(path)}&max=${PAGE_SIZE}`);
      const logData = await logRes.json();
      if (logData.error) throw new Error(logData.error);

      const newCommits = logData.commits || [];
      const newBranches = logData.branches || [];
      const newTags = logData.tags || [];

      setRepoInfo(infoData);
      setRepoPath(path);
      setCommits(newCommits);
      setBranches(newBranches);
      setTags(newTags);

      let count = -1;
      try {
        const countRes = await fetch(`${API_BASE}/git/unpushed-count?path=${encodeURIComponent(path)}`);
        const countData = await countRes.json();
        count = countData.count ?? -1;
      } catch {}
      setUnpushedCount(count);

      // 写入缓存
      cacheRef.current[path] = {
        repoInfo: infoData,
        commits: newCommits,
        branches: newBranches,
        tags: newTags,
        unpushedCount: count
      };

      // 添加标签
      setTabs(prev => {
        const exists = prev.find(t => t.path === path);
        if (exists) return prev;
        const next = [...prev, { path, label: infoData.name }];
        // 在 setState 回调里设置 activeIndex，保证用最新数组
        setActiveTabIndex(next.length - 1);
        return next;
      });
    } catch (err) {
      setError(err.message);
      setRepoInfo(null);
    } finally {
      setLoading(false);
    }
  }, [tabs]);

  /** 切换到指定标签 */
  const handleTabSelect = useCallback((index) => {
    const tab = tabs[index];
    if (!tab) return;
    if (tab.path === repoPath) return;

    // 先保存当前数据到缓存
    if (repoPath && repoInfo) {
      cacheRef.current[repoPath] = {
        repoInfo,
        commits,
        branches,
        tags,
        unpushedCount
      };
    }

    // 切换到目标标签（从缓存恢复）
    handleConnect(tab.path);
  }, [tabs, repoPath, repoInfo, commits, branches, tags, unpushedCount, handleConnect]);

  /** 关闭标签 */
  const handleTabClose = useCallback((index) => {
    const closingPath = tabs[index]?.path;
    setTabs(prev => {
      const next = [...prev];
      next.splice(index, 1);

      // 清理缓存
      if (closingPath) delete cacheRef.current[closingPath];

      if (next.length === 0) {
        // 最后一个标签关闭
        setRepoPath('');
        setRepoInfo(null);
        setCommits([]);
        setBranches([]);
        setTags([]);
        setActiveTabIndex(-1);
        cacheRef.current = {};
      } else if (closingPath === repoPath) {
        // 关闭的是当前活跃标签 → 切换到相邻标签
        const newIdx = Math.min(index, next.length - 1);
        setActiveTabIndex(newIdx);
        const targetPath = next[newIdx]?.path;
        if (targetPath) handleConnect(targetPath);
      } else if (index < activeTabIndex) {
        // 关闭了前面的标签，调整活跃索引
        setActiveTabIndex(prev => prev - 1);
      }
      return next;
    });
  }, [repoPath, activeTabIndex, handleConnect]);

  /** 加载更多提交 */
  const handleLoadMore = useCallback(async () => {
    if (!repoPath || loadingMore) return;
    setLoadingMore(true);
    try {
      const skip = commits.length;
      const res = await fetch(`${API_BASE}/git/log?path=${encodeURIComponent(repoPath)}&max=${PAGE_SIZE}&skip=${skip}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const newCommits = data.commits || [];
      if (newCommits.length > 0) {
        setCommits(prev => [...prev, ...newCommits]);
      }
      return newCommits;
    } catch (err) {
      console.error('加载更多失败:', err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [repoPath, commits.length, loadingMore]);

  /** 分支操作或提交后的刷新回调 */
  const handleBranchRefresh = useCallback((data) => {
    if (data.branches) {
      setBranches(data.branches);
      if (repoPath) cacheRef.current[repoPath] = { ...cacheRef.current[repoPath], branches: data.branches };
    }
    if (data.commits) {
      setCommits(data.commits);
      if (repoPath) cacheRef.current[repoPath] = { ...cacheRef.current[repoPath], commits: data.commits };
    }
    if (data.tags) {
      setTags(data.tags);
      if (repoPath) cacheRef.current[repoPath] = { ...cacheRef.current[repoPath], tags: data.tags };
    }
    // 刷新推送状态
    fetch(`${API_BASE}/git/unpushed-count?path=${encodeURIComponent(repoPath)}`)
      .then(r => r.json()).then(d => {
        const c = d.count ?? -1;
        setUnpushedCount(c);
        if (repoPath) cacheRef.current[repoPath] = { ...cacheRef.current[repoPath], unpushedCount: c };
      }).catch(() => {});
  }, [repoPath]);

  const handleCommitRefresh = useCallback((data) => {
    if (data.commits) {
      setCommits(data.commits);
      if (repoPath) cacheRef.current[repoPath] = { ...cacheRef.current[repoPath], commits: data.commits };
    }
    if (data.branches) {
      setBranches(data.branches);
      if (repoPath) cacheRef.current[repoPath] = { ...cacheRef.current[repoPath], branches: data.branches };
    }
  }, [repoPath]);

  /** 点击提交 */
  const handleCommitClick = useCallback((commit) => {
    setSelectedCommit(selectedCommit?.hash === commit.hash ? null : commit);
  }, [selectedCommit]);

  /** 推送到远程 */
  const handlePush = useCallback(async (options = {}) => {
    setShowPushModal(false);
    setPushing(true);
    try {
      const res = await fetch(`${API_BASE}/git/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repoPath, ...options })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUnpushedCount(0);
      if (data.commits) setCommits(data.commits);
    } catch (err) {
      setError(err.message);
    } finally {
      setPushing(false);
    }
  }, [repoPath]);

  /** 从远程获取 */
  const handleFetch = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`${API_BASE}/git/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repoPath })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.commits) setCommits(data.commits);
      if (data.branches) setBranches(data.branches);
      fetch(`${API_BASE}/git/unpushed-count?path=${encodeURIComponent(repoPath)}`)
        .then(r => r.json()).then(d => setUnpushedCount(d.count ?? -1)).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setFetching(false);
    }
  }, [repoPath]);

  /** 拉取并合并 */
  const handlePull = useCallback(async () => {
    setShowPullConfirm(false);
    setPulling(true);
    try {
      const res = await fetch(`${API_BASE}/git/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repoPath })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.commits) setCommits(data.commits);
      if (data.branches) setBranches(data.branches);
      setUnpushedCount(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setPulling(false);
    }
  }, [repoPath]);

  /** 提交右键菜单 */
  const handleContextMenu = useCallback((e, commit) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, commit });
  }, []);

  /** 关闭右键菜单 */
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  /** Cherry-pick */
  const handleCherryPick = useCallback(async (hash) => {
    setCherryPickConfirm(null);
    setContextMenu(null);
    try {
      const res = await fetch(`${API_BASE}/git/cherry-pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repoPath, hash })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.commits) setCommits(data.commits);
      if (data.branches) setBranches(data.branches);
    } catch (err) {
      setError(err.message);
    }
  }, [repoPath]);

  /** Revert */
  const handleRevert = useCallback(async (hash) => {
    setRevertConfirm(null);
    setContextMenu(null);
    try {
      const res = await fetch(`${API_BASE}/git/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repoPath, hash })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.commits) setCommits(data.commits);
      if (data.branches) setBranches(data.branches);
    } catch (err) {
      setError(err.message);
    }
  }, [repoPath]);

  /** Rebase */
  const handleRebase = useCallback(async (onto) => {
    setShowRebaseModal(false);
    try {
      const res = await fetch(`${API_BASE}/git/rebase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repoPath, onto })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.commits) setCommits(data.commits);
      if (data.branches) setBranches(data.branches);
    } catch (err) {
      setError(err.message);
    }
  }, [repoPath]);

  /** 全局键盘快捷键 */
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape') {
        setSelectedCommit(null);
      } else if (mod && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector('.path-input');
        if (input) input.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
            <span className="repo-badge">
              📁 {repoInfo.name}
            </span>
            <button className="fetch-btn" onClick={handleFetch} disabled={fetching} title="从远程获取更新">
              {fetching ? '⏳' : '⬇'} 获取
            </button>
            <button className="pull-btn" onClick={() => setShowPullConfirm(true)} disabled={pulling} title="拉取并合并远程变更">
              {pulling ? '⏳' : '🔃'} 拉取
            </button>
            <button className="rebase-btn" onClick={() => setShowRebaseModal(true)} title="Rebase 当前分支到其他分支">
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
        {showPushModal && (
          <PushModal
            branches={branches}
            currentBranch={branches.find(b => b.isHead)?.name || ''}
            onConfirm={handlePush}
            onCancel={() => setShowPushModal(false)}
          />
        )}
        {showRebaseModal && (
          <RebaseModal
            branches={branches}
            currentBranch={branches.find(b => b.isHead)?.name || ''}
            repoPath={repoPath}
            onConfirm={handleRebase}
            onCancel={() => setShowRebaseModal(false)}
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
              <CommitGraph
                commits={commits}
                branches={branches}
                tags={tags}
                selectedCommit={selectedCommit}
                onCommitClick={handleCommitClick}
                onContextMenu={handleContextMenu}
                loadingMore={loadingMore}
                onLoadMore={handleLoadMore}
              />
            </main>
            <StageArea
              repoPath={repoPath}
              onRefresh={handleCommitRefresh}
            />
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
            <div className="context-menu-item"
              onClick={() => setCherryPickConfirm(contextMenu.commit.hash)}>
              🍒 Cherry-Pick
            </div>
            <div className="context-menu-item"
              onClick={() => setRevertConfirm(contextMenu.commit.hash)}>
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
