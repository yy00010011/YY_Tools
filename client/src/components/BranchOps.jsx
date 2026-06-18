import React, { useState } from 'react';
import useGitAction from '../hooks/useGitAction';
import ConfirmModal from './ConfirmModal';

/**
 * 分支操作组件 — 在分支列表中嵌入操作按钮
 */
export default function BranchOps({ branches, tags, repoPath, onRefresh }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // { action, name }
  const { doAction, loading, error } = useGitAction(repoPath);

  const handleCreate = () => {
    if (!newBranchName.trim()) return;
    doAction('/branch/create', { name: newBranchName.trim() }, (data) => {
      setNewBranchName('');
      setShowCreate(false);
      onRefresh(data);
    });
  };

  const handleSwitch = (name) => {
    doAction('/branch/switch', { name }, onRefresh);
  };

  const handleMerge = (name) => {
    doAction('/branch/merge', { name }, (data) => {
      setConfirmAction(null);
      onRefresh(data);
    });
  };

  const handleDelete = (name, force) => {
    doAction('/branch/delete', { name, force }, (data) => {
      setConfirmAction(null);
      onRefresh(data);
    });
  };

  const localBranches = (branches || []).filter(b => !b.name.startsWith('remotes/'));
  const remoteBranches = (branches || []).filter(b => b.name.startsWith('remotes/'));
  const headBranch = localBranches.find(b => b.isHead);

  return (
    <div className="branch-ops">
      {/* 错误提示 */}
      {error && <div className="branch-ops-error">{error}</div>}

      {/* 创建分支 */}
      <div className="branch-create-section">
        {!showCreate ? (
          <button className="branch-create-btn" onClick={() => setShowCreate(true)}>
            ＋ 新建分支
          </button>
        ) : (
          <div className="branch-create-form">
            <input
              className="branch-name-input"
              placeholder="新分支名称"
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <button className="stage-btn-sm" onClick={handleCreate} disabled={loading || !newBranchName.trim()}>
              ✓
            </button>
            <button className="stage-btn-sm" onClick={() => { setShowCreate(false); setNewBranchName(''); }}>
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 本地分支列表 */}
      {localBranches.length > 0 && (
        <>
          <h4 style={{ marginTop: 10 }}>本地分支</h4>
          <ul className="branch-ops-list">
            {localBranches.map(b => (
              <li key={b.name} className={`branch-ops-item ${b.isHead ? 'head' : ''}`}>
                <span className="branch-ops-icon">{b.isHead ? '★' : '├'}</span>
                <span className="branch-ops-name" title={b.name}>{b.name}</span>
                <span className="branch-ops-hash">{b.hash}</span>

                {/* 操作按钮 */}
                <div className="branch-ops-actions">
                  {!b.isHead && (
                    <>
                      <button
                        className="branch-action-btn"
                        title="切换到此分支"
                        onClick={() => handleSwitch(b.name)}
                        disabled={loading}
                      >🔀</button>
                      <button
                        className="branch-action-btn"
                        title={`合并 ${b.name} 到当前分支`}
                        onClick={() => setConfirmAction({ action: 'merge', name: b.name })}
                        disabled={loading}
                      >↩</button>
                      <button
                        className="branch-action-btn danger"
                        title="删除分支"
                        onClick={() => setConfirmAction({ action: 'delete', name: b.name })}
                        disabled={loading}
                      >🗑</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* 远程分支 */}
      {remoteBranches.length > 0 && (
        <>
          <h4>远程分支</h4>
          <ul className="branch-ops-list">
            {remoteBranches.map(b => (
              <li key={b.name} className="branch-ops-item remote">
                <span className="branch-ops-icon">☁</span>
                <span className="branch-ops-name">{b.name.replace('remotes/', '')}</span>
                <span className="branch-ops-hash">{b.hash}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* 标签 */}
      {tags && tags.length > 0 && (
        <>
          <h4>🏷 标签</h4>
          <ul className="branch-ops-list">
            {tags.map(t => (
              <li key={t.name} className="branch-ops-item tag">
                <span className="branch-ops-icon">🏷</span>
                <span className="branch-ops-name">{t.name}</span>
                <span className="branch-ops-hash">{t.hash}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* 确认对话框 */}
      {confirmAction?.action === 'merge' && (
        <ConfirmModal
          title="合并分支"
          message={`确定要将 ${confirmAction.name} 合并到 ${headBranch?.name}？`}
          confirmLabel="确认合并"
          onConfirm={() => handleMerge(confirmAction.name)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction?.action === 'delete' && (
        <ConfirmModal
          title="删除分支"
          message={`确定要删除分支 ${confirmAction.name}？`}
          confirmLabel="删除"
          danger
          onConfirm={() => handleDelete(confirmAction.name, false)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
