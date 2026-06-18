import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config';
import useGitAction from '../hooks/useGitAction';
import ConfirmModal from './ConfirmModal';

/**
 * 暂存区 / 提交工作流组件
 * 显示工作区状态，支持 stage/unstage/discard + commit
 */
export default function StageArea({ repoPath, onRefresh }) {
  const [files, setFiles] = useState([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [message, setMessage] = useState('');
  const [collapsed, setCollapsed] = useState(true);
  const [discardTarget, setDiscardTarget] = useState(null); // 待确认丢弃的文件名
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

  /** 通用操作 — 基于 useGitAction，附加文件状态更新 */
  const doAction = (endpoint, body) => {
    doGitAction(endpoint, body, (data) => {
      setFiles(data.files || []);
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

  /** 快速提交全部：git commit -a，跳过手动暂存 */
  const handleCommitAll = () => {
    if (!message.trim()) return;
    doAction('/git/commit', { message: message.trim(), all: true });
    setMessage('');
  };

  const stagedFiles = files.filter(f => f.staged);
  const unstagedFiles = files.filter(f => f.unstaged || f.untracked);
  const totalChanges = files.length;

  return (
    <div className={`stage-area ${collapsed ? 'collapsed' : ''}`}>
      <div className="stage-header" onClick={() => setCollapsed(!collapsed)}>
        <span className="stage-toggle">{collapsed ? '▶' : '▼'}</span>
        <span className="stage-title">📦 工作区</span>
        <span className="stage-branch">🌿 {currentBranch}</span>
        {totalChanges > 0 && (
          <span className="stage-count">{totalChanges} 个变更</span>
        )}
      </div>

      {!collapsed && (
        <div className="stage-body">
          {error && <div className="stage-error">{error}</div>}

          {totalChanges === 0 ? (
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
                  {stagedFiles.map(f => (
                    <div key={f.file} className={`stage-file staged`}>
                      <span className="stage-file-status">{f.status}</span>
                      <span className="stage-file-name">{f.file}</span>
                      <button className="stage-btn-sm" onClick={() => handleUnstage(f.file)} disabled={loading}>
                        −
                      </button>
                    </div>
                  ))}
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
                  {unstagedFiles.map(f => (
                    <div key={f.file} className={`stage-file unstaged ${f.untracked ? 'untracked' : ''}`}>
                      <span className="stage-file-status">{f.status}</span>
                      <span className="stage-file-name">
                        {f.untracked && '🆕 '}{f.file}
                      </span>
                      <button className="stage-btn-sm" onClick={() => handleStage(f.file)} disabled={loading}>
                        +
                      </button>
                      {!f.untracked && (
                        <button className="stage-btn-sm danger" onClick={() => handleDiscard(f.file)} disabled={loading}>
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
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
