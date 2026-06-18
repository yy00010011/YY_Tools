import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE } from '../config';
import useGitAction from '../hooks/useGitAction';
import ConfirmModal from './ConfirmModal';
import { parseDiffFiles, DiffViewer } from '../utils/diffUtils';

/**
 * 暂存区 / 提交工作流组件
 * 显示工作区状态，支持 stage/unstage/discard + commit，点击文件查看 diff
 */
export default function StageArea({ repoPath, onRefresh }) {
  const [files, setFiles] = useState([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [message, setMessage] = useState('');
  const [collapsed, setCollapsed] = useState(true);
  const [discardTarget, setDiscardTarget] = useState(null); // 待确认丢弃的文件名
  const [diffTarget, setDiffTarget] = useState(null); // 当前查看 diff 的文件 { file, staged }
  const [diffContent, setDiffContent] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffExpanded, setDiffExpanded] = useState({});
  const [stashEntries, setStashEntries] = useState([]);
  const [stashLoading, setStashLoading] = useState(false);
  const [stashMessage, setStashMessage] = useState('');
  const { doAction: doGitAction, loading, error } = useGitAction(repoPath);

  /** 加载状态 */
  const loadStatus = useCallback(async (signal) => {
    if (!repoPath) return;
    try {
      const res = await fetch(`${API_BASE}/git/status?path=${encodeURIComponent(repoPath)}`, { signal });
      const data = await res.json();
      if (!data.error) {
        setFiles(data.files || []);
        setCurrentBranch(data.currentBranch || '');
      }
    } catch (e) {
      if (e.name !== 'AbortError') { /* 忽略取消的请求 */ }
    }
  }, [repoPath]);

  useEffect(() => {
    const controller = new AbortController();
    loadStatus(controller.signal);
    return () => controller.abort();
  }, [loadStatus]);

  // 有变更时自动展开
  useEffect(() => {
    if (files.length > 0) setCollapsed(false);
  }, [files.length]);

  // 有 stash 时自动展开
  useEffect(() => {
    if (stashEntries.length > 0) setCollapsed(false);
  }, [stashEntries.length]);

  /** 通用操作 — 基于 useGitAction，附加文件状态更新 */
  const doAction = (endpoint, body) => {
    doGitAction(endpoint, body, (data) => {
      setFiles(data.files || []);
      setDiffTarget(null); // 操作后关闭 diff
      if (data.currentBranch) setCurrentBranch(data.currentBranch);
      if (onRefresh && endpoint === '/git/commit') onRefresh(data);
    });
  };

  const handleStageAll = () => {
    const unstaged = files.filter(f => f.unstaged || f.untracked).map(f => f.file);
    if (unstaged.length) doAction('/git/stage', { files: unstaged });
  };

  const handleUnstageAll = () => {
    const staged = files.filter(f => f.staged).map(f => f.file);
    if (staged.length) doAction('/git/unstage', { files: staged });
  };

  const handleStage = (file) => doAction('/git/stage', { files: [file] });
  const handleUnstage = (file) => doAction('/git/unstage', { files: [file] });
  const handleDiscard = (file) => {
    setDiscardTarget(file);
  };

  const confirmDiscard = () => {
    if (discardTarget) {
      doAction('/git/discard', { files: [discardTarget] });
      setDiscardTarget(null);
    }
  };

  const handleCommit = () => {
    if (!message.trim()) return;
    doAction('/git/commit', { message: message.trim() });
    setMessage('');
  };

  /** 点击文件查看 diff */
  const handleViewDiff = useCallback(async (file, staged) => {
    // 再次点击同一文件则关闭
    if (diffTarget?.file === file && diffTarget?.staged === staged) {
      setDiffTarget(null);
      setDiffContent('');
      return;
    }
    setDiffTarget({ file, staged });
    setDiffLoading(true);
    setDiffExpanded({});
    const endpoint = staged ? '/git/diff-staged' : '/git/diff-unstaged';
    const controller = new AbortController();
    try {
      const res = await fetch(`${API_BASE}${endpoint}?path=${encodeURIComponent(repoPath)}`, {
        signal: controller.signal
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDiffContent(data.diff || '');
    } catch (e) {
      if (e.name !== 'AbortError') setDiffContent('');
    } finally {
      setDiffLoading(false);
    }
  }, [repoPath, diffTarget]);

  /** 加载 stash 列表 */
  const loadStashList = useCallback(async () => {
    if (!repoPath) return;
    setStashLoading(true);
    try {
      const res = await fetch(`${API_BASE}/git/stash-list?path=${encodeURIComponent(repoPath)}`);
      const data = await res.json();
      if (!data.error) setStashEntries(data.list || []);
    } catch { /* 忽略 */ }
    finally { setStashLoading(false); }
  }, [repoPath]);

  useEffect(() => {
    loadStashList();
  }, [loadStashList]);

  /** stash 操作 */
  const doStashAction = async (endpoint, body = {}) => {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repoPath, ...body })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStashEntries(data.list || []);
      setFiles(data.files || files);
      if (data.currentBranch) setCurrentBranch(data.currentBranch);
    } catch (e) {
      // 错误由 error state 处理
    }
  };

  const handleStashPush = () => {
    doStashAction('/git/stash-push', stashMessage.trim() ? { message: stashMessage.trim() } : {});
    setStashMessage('');
  };

  const handleStashPop = (index) => doStashAction('/git/stash-pop', { index });
  const handleStashApply = (index) => doStashAction('/git/stash-apply', { index });
  const handleStashDrop = (index) => doStashAction('/git/stash-drop', { index });

  const diffFiles = useMemo(() => parseDiffFiles(diffContent), [diffContent]);

  const toggleDiffFile = (file) => {
    setDiffExpanded(prev => ({ ...prev, [file]: !prev[file] }));
  };

  /** 快速提交全部：git commit -a，跳过手动暂存 */
  const handleCommitAll = () => {
    if (!message.trim()) return;
    doAction('/git/commit', { message: message.trim(), all: true });
    setMessage('');
  };

  const stagedFiles = files.filter(f => f.staged);
  const unstagedFiles = files.filter(f => f.unstaged || f.untracked);
  const totalChanges = files.length;

  /** 渲染带 diff 展开的文件行 */
  const renderFileRow = (f, staged) => {
    const isExpanded = diffTarget?.file === f.file && diffTarget?.staged === staged;
    return (
      <div key={f.file}>
        <div
          className={`stage-file ${staged ? 'staged' : 'unstaged'} ${f.untracked ? 'untracked' : ''} ${isExpanded ? 'diff-expanded' : ''}`}
          onClick={() => handleViewDiff(f.file, staged)}
          title="点击查看差异"
        >
          <span className="stage-file-status">{f.status}</span>
          <span className="stage-file-name">
            {f.untracked && '🆕 '}{f.file}
          </span>
          {staged ? (
            <button className="stage-btn-sm" onClick={(e) => { e.stopPropagation(); handleUnstage(f.file); }} disabled={loading}>
              −
            </button>
          ) : (
            <>
              <button className="stage-btn-sm" onClick={(e) => { e.stopPropagation(); handleStage(f.file); }} disabled={loading}>
                +
              </button>
              {!f.untracked && (
                <button className="stage-btn-sm danger" onClick={(e) => { e.stopPropagation(); handleDiscard(f.file); }} disabled={loading}>
                  ✕
                </button>
              )}
            </>
          )}
        </div>
        {isExpanded && (
          <div className="stage-diff-inline">
            {diffLoading ? (
              <div className="diff-loading">⏳ 加载差异...</div>
            ) : diffFiles.length > 0 ? (
              <DiffViewer
                files={diffFiles}
                expandedFiles={diffExpanded}
                toggleFile={toggleDiffFile}
              />
            ) : (
              <div className="diff-empty">无差异</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`stage-area ${collapsed ? 'collapsed' : ''}`}>
      <div className="stage-header" onClick={() => setCollapsed(!collapsed)}>
        <span className="stage-toggle">{collapsed ? '▶' : '▼'}</span>
        <span className="stage-title">📦 工作区</span>
        <span className="stage-branch">🌿 {currentBranch}</span>
        {totalChanges > 0 && (
          <span className="stage-count">{totalChanges} 个变更</span>
        )}
        {stashEntries.length > 0 && (
          <span className="stage-stash-count">📌 {stashEntries.length} 个暂存</span>
        )}
      </div>

      {!collapsed && (
        <div className="stage-body">
          {error && <div className="stage-error">{error}</div>}

          {/* Stash 区域 */}
          {stashEntries.length > 0 && (
            <div className="stage-section stash-section">
              <div className="stage-section-header">
                <span>📌 暂存列表 ({stashEntries.length})</span>
              </div>
              {stashEntries.map((e, i) => (
                <div key={i} className="stash-entry">
                  <span className="stash-entry-index">stash@&#123;{e.index}&#125;</span>
                  <span className="stash-entry-msg">{e.message.replace(/^[^:]+:\s*/, '') || '(无说明)'}</span>
                  <div className="stash-entry-actions">
                    <button className="stage-btn-sm" onClick={() => handleStashPop(e.index)} title="弹出并删除">⬆️</button>
                    <button className="stage-btn-sm" onClick={() => handleStashApply(e.index)} title="应用但不删除">↩</button>
                    <button className="stage-btn-sm danger" onClick={() => handleStashDrop(e.index)} title="删除">🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stash 暂存表单 */}
          {unstagedFiles.length > 0 && (
            <div className="stage-section stash-push-section">
              <div className="stage-section-header">
                <span>💾 暂存工作区</span>
              </div>
              <div className="stage-commit-form" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
                <input
                  className="commit-msg-input"
                  placeholder="暂存说明（可选）"
                  value={stashMessage}
                  onChange={e => setStashMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleStashPush()}
                />
                <button className="commit-btn" style={{ background: '#e5c07b', fontSize: 12 }}
                  onClick={handleStashPush}>
                  💾 暂存
                </button>
              </div>
            </div>
          )}

          {totalChanges === 0 && stashEntries.length === 0 ? (
            <div className="stage-empty">工作区干净，没有待提交的变更</div>
          ) : (
            <>
              {/* 暂存区 */}
              {stagedFiles.length > 0 && (
                <div className="stage-section">
                  <div className="stage-section-header">
                    <span>✅ 已暂存 ({stagedFiles.length})</span>
                    <button className="stage-btn-sm" onClick={handleUnstageAll} disabled={loading}>
                      全部取消暂存
                    </button>
                  </div>
                  {stagedFiles.map(f => renderFileRow(f, true))}
                </div>
              )}

              {/* 未暂存区 */}
              {unstagedFiles.length > 0 && (
                <div className="stage-section">
                  <div className="stage-section-header">
                    <span>📝 未暂存 ({unstagedFiles.length})</span>
                    <button className="stage-btn-sm" onClick={handleStageAll} disabled={loading}>
                      全部暂存
                    </button>
                  </div>
                  {unstagedFiles.map(f => renderFileRow(f, false))}
                </div>
              )}

              {/* 提交表单（已暂存） */}
              {stagedFiles.length > 0 && (
                <div className="stage-commit-form">
                  <textarea
                    className="commit-msg-input"
                    placeholder="输入提交说明..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={2}
                    disabled={loading}
                    onKeyDown={e => {
                      if (e.ctrlKey && e.key === 'Enter') handleCommit();
                    }}
                  />
                  <button
                    className="commit-btn"
                    onClick={handleCommit}
                    disabled={loading || !message.trim()}
                  >
                    {loading ? '⏳' : '💾'} 提交已暂存
                  </button>
                </div>
              )}

              {/* 快速提交全部（跳过暂存，git commit -a） */}
              {unstagedFiles.some(f => f.modified || f.deleted) && (
                <div className="stage-commit-form quick-commit">
                  <div className="quick-commit-hint">
                    ⚡ 有已跟踪文件的变更未暂存，可直接提交全部（跳过暂存步骤）
                  </div>
                  <textarea
                    className="commit-msg-input"
                    placeholder="输入提交说明...（将自动包含所有已跟踪文件的变更）"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={2}
                    disabled={loading}
                    onKeyDown={e => {
                      if (e.ctrlKey && e.key === 'Enter') handleCommitAll();
                    }}
                  />
                  <button
                    className="commit-btn quick"
                    onClick={handleCommitAll}
                    disabled={loading || !message.trim()}
                  >
                    {loading ? '⏳' : '🚀'} 快速提交全部
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {discardTarget && (
        <ConfirmModal
          title="丢弃变更"
          message={`确定丢弃 "${discardTarget}" 的变更？此操作不可撤销。`}
          confirmLabel="丢弃"
          danger
          onConfirm={confirmDiscard}
          onCancel={() => setDiscardTarget(null)}
        />
      )}
    </div>
  );
}
