import React, { useState, useEffect } from 'react';
import { remoteApi } from '../api';

interface RemoteEntry {
  name: string;
  url: string;
  fetch: boolean;
  push: boolean;
}

export default function RemoteConfigModal({
  repoPath,
  onClose,
  onRefresh,
}: {
  repoPath: string;
  onClose: () => void;
  onRefresh: (data: any) => void;
}) {
  const [remotes, setRemotes] = useState<RemoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('origin');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  /** 加载远程仓库列表 */
  const loadRemotes = async () => {
    setLoading(true);
    try {
      const data = await remoteApi.listRemotes(repoPath);
      setRemotes(data.remotes || []);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRemotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 添加/更新远程仓库 */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) return;

    setAdding(true);
    try {
      const data = await remoteApi.addRemote(repoPath, trimmedName, trimmedUrl);
      setRemotes(data.remotes || []);
      setUrl('');
      setShowForm(false);
      if (onRefresh) onRefresh(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content remote-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔗 远程仓库配置</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="modal-error">❌ {error}</div>}

        <div className="modal-body">
          {/* 已有的远程仓库 */}
          <div className="remote-section">
            <h4>已配置的远程仓库</h4>
            {loading ? (
              <p className="remote-loading">⏳ 加载中...</p>
            ) : remotes.length === 0 ? (
              <p className="remote-empty">暂无远程仓库，请添加一个。通常命名为 "origin"。</p>
            ) : (
              <ul className="remote-list">
                {remotes.map((r) => (
                  <li key={r.name} className="remote-item">
                    <span className="remote-name">{r.name}</span>
                    <span className="remote-url">{r.url}</span>
                    <span className="remote-type">({r.fetch ? 'fetch' : ''}{r.fetch && r.push ? ' / ' : ''}{r.push ? 'push' : ''})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 添加表单 */}
          {!showForm ? (
            <button
              className="remote-add-btn"
              onClick={() => { setShowForm(true); setError(''); }}
            >
              ➕ 添加远程仓库
            </button>
          ) : (
            <form className="remote-form" onSubmit={handleAdd}>
              <div className="form-row">
                <label>名称：</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="origin"
                  className="form-input"
                  autoFocus
                />
              </div>
              <div className="form-row">
                <label>地址：</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  className="form-input"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="form-submit" disabled={adding || !name.trim() || !url.trim()}>
                  {adding ? '⏳ 添加中...' : '✅ 确认'}
                </button>
                <button type="button" className="form-cancel" onClick={() => setShowForm(false)}>
                  取消
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
