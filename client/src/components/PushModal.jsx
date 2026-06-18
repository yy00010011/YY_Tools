import React, { useState } from 'react';

/**
 * 推送高级选项对话框
 * 支持选择 remote、branch、tags、force 参数
 */
export default function PushModal({
  branches = [],
  currentBranch = '',
  onConfirm,
  onCancel
}) {
  const [remote, setRemote] = useState('origin');
  const [branch, setBranch] = useState(currentBranch || '');
  const [pushTags, setPushTags] = useState(false);
  const [force, setForce] = useState(false);

  const handleConfirm = () => {
    onConfirm({
      remote: remote.trim() || 'origin',
      branch: branch.trim() || undefined,
      tags: pushTags,
      force
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box push-modal" onClick={e => e.stopPropagation()}>
        <h4>📤 推送设置</h4>

        <div className="push-modal-field">
          <label className="push-modal-label">远程仓库</label>
          <input
            className="push-modal-input"
            value={remote}
            onChange={e => setRemote(e.target.value)}
            placeholder="origin"
          />
        </div>

        <div className="push-modal-field">
          <label className="push-modal-label">分支（留空推送当前分支）</label>
          <input
            className="push-modal-input"
            value={branch}
            onChange={e => setBranch(e.target.value)}
            list="push-branch-list"
            placeholder={currentBranch || '（当前分支）'}
          />
          <datalist id="push-branch-list">
            {branches.filter(b => !b.name.startsWith('remotes/')).map(b => (
              <option key={b.name} value={b.name} />
            ))}
          </datalist>
        </div>

        <div className="push-modal-field checkbox-field">
          <label className="push-modal-checkbox">
            <input
              type="checkbox"
              checked={pushTags}
              onChange={e => setPushTags(e.target.checked)}
            />
            <span>同时推送所有标签（--tags）</span>
          </label>
        </div>

        <div className="push-modal-field checkbox-field">
          <label className="push-modal-checkbox">
            <input
              type="checkbox"
              checked={force}
              onChange={e => setForce(e.target.checked)}
            />
            <span>强制推送（--force）</span>
          </label>
          {force && (
            <div className="push-modal-warning">
              ⚠️ 强制推送会覆盖远程历史，可能导致他人工作丢失，请谨慎使用。
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="stage-btn-sm" onClick={handleConfirm}>
            📤 推送
          </button>
          <button className="stage-btn-sm" onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
