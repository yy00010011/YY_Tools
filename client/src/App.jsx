import React, { useState, useCallback, useEffect } from 'react';
import { API_BASE, PAGE_SIZE } from './config';
import RepoInput from './components/RepoInput';
import BranchOps from './components/BranchOps';
import CommitGraph from './components/CommitGraph';
import CommitDetail from './components/CommitDetail';
import StageArea from './components/StageArea';
import PushModal from './components/PushModal';
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

  /** 连接仓库 */
  const handleConnect = useCallback(async (path) => {
    setLoading(true);
    setError('');
    setSelectedCommit(null);
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

      // 查询未推送提交数
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
    if (data.branches) setBranches(data.branches);
    if (data.commits) setCommits(data.commits);
    if (data.tags) setTags(data.tags);
    // 刷新推送状态
    fetch(`${API_BASE}/git/unpushed-count?path=${encodeURIComponent(repoPath)}`)
      .then(r => r.json()).then(d => setUnpushedCount(d.count ?? -1)).catch(() => {});
  }, [repoPath]);

  const handleCommitRefresh = useCallback((data) => {
    if (data.commits) setCommits(data.commits);
    if (data.branches) setBranches(data.branches);
  }, []);

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
        {repoInfo && (
          <span className="repo-badge">
            📁 {repoInfo.name}
          </span>
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
    </div>
  );
}
