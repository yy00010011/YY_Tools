import React, { useState } from 'react';

/**
 * Rebase 对话框 — 选择 onto 分支执行 git rebase
 */
export default function RebaseModal({
  branches = [],
  currentBranch = '',
  repoPath = '',
  onConfirm,
  onCancel
}) {
  const [onto, setOnto] = useState('');

  const localBranches = branches
    .filter(b => !b.name.startsWith('remotes/') && b.name !== currentBranch);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h4>🔀 Rebase</h4>
        <p>将 <strong>{currentBranch}</strong> 变基到目标分支上。冲突时会自动 abort。</p>

        <div className="push-modal-field">
          <label className="push-modal-label">目标分支 (onto)</label>
          <select
            className="push-modal-input"
            value={onto}
            onChange={e => setOnto(e.target.value)}
          >
            <option value="">选择分支...</option>
            {localBranches.map(b => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="modal-actions">
          <button
            className="stage-btn-sm danger"
            onClick={() => onConfirm(onto)}
            disabled={!onto}
          >
            Rebase
          </button>
          <button className="stage-btn-sm" onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  );
}
