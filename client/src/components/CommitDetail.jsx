import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE } from '../config';
import { parseDiffFiles, DiffViewer } from '../utils/diffUtils';
import FileBrowser from './FileBrowser';

/**
 * 增强版提交详情面板
 * 文件列表 + 高亮 diff + 元信息
 */
export default function CommitDetail({ commit, repoPath }) {
  const [diff, setDiff] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedFiles, setExpandedFiles] = useState({});
  const [activeTab, setActiveTab] = useState('diff'); // 'diff' | 'files'

  useEffect(() => {
    if (!commit) return;
    setLoading(true);
    setExpandedFiles({});
    const controller = new AbortController();
    fetch(`${API_BASE}/git/diff?path=${encodeURIComponent(repoPath)}&hash=${commit.hash}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        setDiff(data.diff || '');
        setLoading(false);
      })
      .catch(e => {
        if (e.name !== 'AbortError') setLoading(false);
      });
    return () => controller.abort();
  }, [commit, repoPath]);

  const diffFiles = useMemo(() => parseDiffFiles(diff), [diff]);

  const toggleFile = (file) => {
    setExpandedFiles(prev => ({ ...prev, [file]: !prev[file] }));
  };

  /** 全部展开/折叠 */
  const expandAll = () => {
    const all = {};
    diffFiles.forEach(f => { all[f.file] = true; });
    setExpandedFiles(all);
  };
  const collapseAll = () => setExpandedFiles({});

  return (
    <div className="commit-detail">
      {/* 元信息 */}
      <h3>📋 提交详情</h3>
      <div className="detail-meta">
        <div className="meta-row">
          <span className="meta-label">Hash</span>
          <code>{commit.hash}</code>
        </div>
        <div className="meta-row">
          <span className="meta-label">作者</span>
          <span>{commit.authorName} &lt;{commit.authorEmail}&gt;</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">时间</span>
          <span>{commit.date}</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">说明</span>
          <span className="commit-subject">{commit.subject}</span>
        </div>
        {commit.parents.length > 0 && (
          <div className="meta-row">
            <span className="meta-label">父提交</span>
            <div>
              {commit.parents.map((p, i) => (
                <code key={i} className="parent-hash">{p.substring(0, 7)}</code>
              ))}
            </div>
          </div>
        )}
        {commit.refs && (commit.refs.branches.length > 0 || commit.refs.tags.length > 0) && (
          <div className="meta-row">
            <span className="meta-label">引用</span>
            <div className="ref-tags">
              {commit.refs.branches.map(b => (
                <span key={b} className="ref-badge branch">{b}</span>
              ))}
              {commit.refs.tags.map(t => (
                <span key={t} className="ref-badge tag">{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tab 切换 */}
      <div className="detail-tabs">
        <button
          className={`detail-tab ${activeTab === 'diff' ? 'active' : ''}`}
          onClick={() => setActiveTab('diff')}
        >
          📝 变更
        </button>
        <button
          className={`detail-tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          📁 文件
        </button>
      </div>

      {activeTab === 'diff' ? (
        <>
          {/* 变更文件 */}
          {loading ? (
            <div className="diff-loading">⏳ 加载变更内容...</div>
          ) : diffFiles.length > 0 ? (
            <>
              <div className="diff-toolbar">
                <h4>📝 变更文件 ({diffFiles.length})</h4>
                <div className="diff-toolbar-actions">
                  <button className="stage-btn-sm" onClick={expandAll}>全部展开</button>
                  <button className="stage-btn-sm" onClick={collapseAll}>全部折叠</button>
                </div>
              </div>

              {/* 变更统计 */}
              <div className="diff-stats">
                <span className="stat-added">+{diffFiles.reduce((s, f) => s + f.added, 0)}</span>
                <span className="stat-removed">−{diffFiles.reduce((s, f) => s + f.removed, 0)}</span>
              </div>

              <DiffViewer
                files={diffFiles}
                expandedFiles={expandedFiles}
                toggleFile={toggleFile}
              />
            </>
          ) : (
            <div className="diff-empty">无变更内容（可能是初始提交）</div>
          )}
        </>
      ) : (
        <FileBrowser repoPath={repoPath} hash={commit.hash} />
      )}
    </div>
  );
}
