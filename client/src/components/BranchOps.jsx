import React, { useState } from 'react';
import useGitAction from '../hooks/useGitAction';
import ConfirmModal from './ConfirmModal';

/**
 * 分支/标签操作组件 — 在分支列表中嵌入操作按钮
 */
export default function BranchOps({ branches, tags, repoPath, onRefresh }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [showTagCreate, setShowTagCreate] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // { action, name, remote?, branch? }
  const [compareBase, setCompareBase] = useState('');
  const [compareTarget, setCompareTarget] = useState('');
  const [compareDiff, setCompareDiff] = useState('');
  const [compareLoading, setCompareLoading] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
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
    doAction('/branch/delete', { name, force }, (data, rawResponse) => {
      if (rawResponse?.error && !force) {
        setConfirmAction({ action: 'force-delete', name });
        return;
      }
      setConfirmAction(null);
      if (data) onRefresh(data);
    });
  };

  const handleTagCreate = () => {
    if (!newTagName.trim()) return;
    doAction('/tag/create', { name: newTagName.trim() }, (data) => {
      setNewTagName('');
      setShowTagCreate(false);
      onRefresh(data);
    });
  };

  const handleTagDelete = (name) => {
    doAction('/tag/delete', { name }, (data) => {
      setConfirmAction(null);
      if (data) onRefresh(data);
    });
  };

  const handleCheckoutRemote = (remoteBranch) => {
    doAction('/branch/checkout-remote', { remoteBranch }, (data) => {
      onRefresh(data);
    });
  };

  const handleDeleteRemote = (remote, branch) => {
    doAction('/branch/delete-remote', { remote, branch }, (data) => {
      setConfirmAction(null);
      if (data) onRefresh(data);
    });
  };

  const handleCompare = async () => {
    if (!compareBase || !compareTarget) return;
    setCompareLoading(true);
    try {
      const res = await fetch(`/api/git/compare?path=${encodeURIComponent(repoPath)}&base=${encodeURIComponent(compareBase)}&compare=${encodeURIComponent(compareTarget)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCompareDiff(data.diff || '');
      setShowCompare(true);
    } catch (e) {
      setCompareDiff(`// 对比失败: ${e.message}`);
      setShowCompare(true);
    } finally {
      setCompareLoading(false);
    }
  };

  const allNames = [
    ...(branches || []).filter(b => !b.name.startsWith('remotes/')).map(b => b.name),
    ...(tags || []).map(t => t.name)
  ];

  const localBranches = (branches || []).filter(b => !b.name.startsWith('remotes/'));
  const remoteBranches = (branches || []).filter(b => b.name.startsWith('remotes/'));
  const headBranch = localBranches.find(b => b.isHead);

  /** 从 remotes/origin/main 提取 remote=origin, branch=main */
  const parseRemote = (fullName) => {
    const match = fullName.match(/^remotes\/([^/]+)\/(.+)/);
    return match ? { remote: match[1], branch: match[2] } : { remote: 'origin', branch: fullName.replace('remotes/', '') };
  };

  return (
    <div className="branch-ops">
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

      {/* 本地分支 */}
      {localBranches.length > 0 && (
        <>
          <h4 style={{ marginTop: 10 }}>本地分支</h4>
          <ul className="branch-ops-list">
            {localBranches.map(b => (
              <li key={b.name} className={`branch-ops-item ${b.isHead ? 'head' : ''}`}>
                <span className="branch-ops-icon">{b.isHead ? '★' : '├'}</span>
                <span className="branch-ops-name" title={b.name}>{b.name}</span>
                <span className="branch-ops-hash">{b.hash}</span>
                <div className="branch-ops-actions">
                  {!b.isHead && (
                    <>
                      <button className="branch-action-btn" title="切换到此分支"
                        onClick={() => handleSwitch(b.name)} disabled={loading}>🔀</button>
                      <button className="branch-action-btn" title={`合并 ${b.name} 到当前分支`}
                        onClick={() => setConfirmAction({ action: 'merge', name: b.name })} disabled={loading}>↩</button>
                      <button className="branch-action-btn danger" title="删除分支"
                        onClick={() => setConfirmAction({ action: 'delete', name: b.name })} disabled={loading}>🗑</button>
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
            {remoteBranches.map(b => {
              const { remote, branch } = parseRemote(b.name);
              return (
                <li key={b.name} className="branch-ops-item remote">
                  <span className="branch-ops-icon">☁</span>
                  <span className="branch-ops-name">{b.name.replace('remotes/', '')}</span>
                  <span className="branch-ops-hash">{b.hash}</span>
                  <div className="branch-ops-actions">
                    <button className="branch-action-btn" title="检出为本地分支"
                      onClick={() => handleCheckoutRemote(b.name)} disabled={loading}>🔀</button>
                    <button className="branch-action-btn danger" title="删除远程分支"
                      onClick={() => setConfirmAction({ action: 'delete-remote', name: b.name, remote, branch })} disabled={loading}>🗑</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* 标签 */}
      <div className="branch-create-section" style={{ marginTop: 8 }}>
        {!showTagCreate ? (
          <button className="branch-create-btn" style={{ color: '#f0c674', borderColor: '#f0c67444', background: '#f0c67415' }}
            onClick={() => setShowTagCreate(true)}>
            🏷 新建标签
          </button>
        ) : (
          <div className="branch-create-form">
            <input className="branch-name-input" placeholder="新标签名称"
              value={newTagName} onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTagCreate()} autoFocus />
            <button className="stage-btn-sm" onClick={handleTagCreate} disabled={loading || !newTagName.trim()}>✓</button>
            <button className="stage-btn-sm" onClick={() => { setShowTagCreate(false); setNewTagName(''); }}>✕</button>
          </div>
        )}
      </div>
      {tags && tags.length > 0 && (
        <>
          <h4>🏷 标签</h4>
          <ul className="branch-ops-list">
            {tags.map(t => (
              <li key={t.name} className="branch-ops-item tag">
                <span className="branch-ops-icon">🏷</span>
                <span className="branch-ops-name">{t.name}</span>
                <span className="branch-ops-hash">{t.hash}</span>
                <div className="branch-ops-actions">
                  <button className="branch-action-btn danger" title="删除标签"
                    onClick={() => setConfirmAction({ action: 'delete-tag', name: t.name })} disabled={loading}>🗑</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* 分支对比 */}
      <div style={{ marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
        <h4>🔍 分支对比</h4>
        <select className="compare-select" value={compareBase}
          onChange={e => setCompareBase(e.target.value)}
          style={{ width: '100%', marginBottom: 4 }}>
          <option value="">Base 分支/标签...</option>
          {allNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select className="compare-select" value={compareTarget}
          onChange={e => setCompareTarget(e.target.value)}
          style={{ width: '100%', marginBottom: 4 }}>
          <option value="">Compare 分支/标签...</option>
          {allNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <button className="stage-btn-sm" onClick={handleCompare}
          disabled={compareLoading || !compareBase || !compareTarget}
          style={{ width: '100%' }}>
          {compareLoading ? '⏳' : '🔍'} 对比
        </button>
        {showCompare && (
          <pre className="compare-result">{compareDiff || '(无差异)'}</pre>
        )}
      </div>

      {/* 确认对话框 */}
      {confirmAction?.action === 'merge' && (
        <ConfirmModal title="合并分支"
          message={`确定要将 ${confirmAction.name} 合并到 ${headBranch?.name}？`}
          confirmLabel="确认合并"
          onConfirm={() => handleMerge(confirmAction.name)}
          onCancel={() => setConfirmAction(null)} />
      )}
      {confirmAction?.action === 'delete' && (
        <ConfirmModal title="删除分支"
          message={`确定要删除分支 ${confirmAction.name}？`}
          confirmLabel="删除" danger
          onConfirm={() => handleDelete(confirmAction.name, false)}
          onCancel={() => setConfirmAction(null)} />
      )}
      {confirmAction?.action === 'force-delete' && (
        <ConfirmModal title="强制删除分支"
          message={`分支 ${confirmAction.name} 尚未合并，确定强制删除吗？此操作不可撤销。`}
          confirmLabel="强制删除" danger
          onConfirm={() => handleDelete(confirmAction.name, true)}
          onCancel={() => setConfirmAction(null)} />
      )}
      {confirmAction?.action === 'delete-tag' && (
        <ConfirmModal title="删除标签"
          message={`确定要删除标签 ${confirmAction.name}？`}
          confirmLabel="删除" danger
          onConfirm={() => handleTagDelete(confirmAction.name)}
          onCancel={() => setConfirmAction(null)} />
      )}
      {confirmAction?.action === 'delete-remote' && (
        <ConfirmModal title="删除远程分支"
          message={`确定要删除远程分支 ${confirmAction.branch}？此操作不可撤销。`}
          confirmLabel="删除" danger
          onConfirm={() => handleDeleteRemote(confirmAction.remote, confirmAction.branch)}
          onCancel={() => setConfirmAction(null)} />
      )}
    </div>
  );
}
