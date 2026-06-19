import React, { useState } from 'react';
import { advancedApi } from '../api';

interface RemoteEntry {
  name: string;
  url: string;
  fetch: boolean;
  push: boolean;
}

export default function PushCommitModal({
  commitHash,
  shortHash,
  remotes,
  onConfirm,
  onCancel,
}: {
  commitHash: string;
  shortHash: string;
  remotes: RemoteEntry[];
  onConfirm: (remote: string, branch: string, force: boolean) => void;
  onCancel: () => void;
}) {
  const [remote, setRemote] = useState(remotes[0]?.name || 'origin');
  const [branch, setBranch] = useState('');
  const [force, setForce] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remote.trim() || !branch.trim()) return;
    onConfirm(remote.trim(), branch.trim(), force);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box push-commit-modal" onClick={(e) => e.stopPropagation()}>
        <h4>📤 推送提交到远程</h4>
        <p>
          将提交 <strong>{shortHash}</strong> 推送到远程分支
        </p>

        <form onSubmit={handleSubmit}>
          <div className="push-modal-field">
            <label className="push-modal-label">远程仓库</label>
            {remotes.length > 0 ? (
              <select
                className="push-modal-input"
                value={remote}
                onChange={(e) => setRemote(e.target.value)}
              >
                {remotes.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name} ({r.url})
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="push-modal-input"
                value={remote}
                onChange={(e) => setRemote(e.target.value)}
                placeholder="origin"
              />
            )}
          </div>

          <div className="push-modal-field">
            <label className="push-modal-label">目标分支名</label>
            <input
              className="push-modal-input"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="例如: feature/backport-fix"
              autoFocus
            />
          </div>

          <div className="push-modal-field">
            <label className="push-modal-checkbox">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
              />
              <span>强制推送 (--force)</span>
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onCancel}>
              取消
            </button>
            <button
              type="submit"
              className="btn-confirm"
              disabled={!remote.trim() || !branch.trim()}
            >
              📤 推送
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
