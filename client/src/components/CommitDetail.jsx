import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE } from '../config';

/**
 * 解析 diff 字符串，提取每个文件的变更
 */
function parseDiffFiles(diffText) {
  if (!diffText) return [];
  const files = [];
  const lines = diffText.split('\n');
  let currentFile = null;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      if (currentFile) files.push(currentFile);
      // 提取文件名: diff --git a/file b/file
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      currentFile = {
        file: match ? match[2] : '',
        header: [line],
        hunks: [],
        added: 0,
        removed: 0
      };
    } else if (currentFile) {
      currentFile.header.push(line);
      if (line.startsWith('@@')) {
        currentFile.hunks.push({ header: line, lines: [] });
      } else if (currentFile.hunks.length > 0) {
        const hunk = currentFile.hunks[currentFile.hunks.length - 1];
        hunk.lines.push(line);
        if (line.startsWith('+')) currentFile.added++;
        else if (line.startsWith('-')) currentFile.removed++;
      }
    }
  }
  if (currentFile) files.push(currentFile);
  return files;
}

/**
 * 渲染单行 diff，带颜色标记
 */
function DiffLine({ line }) {
  let cls = 'diff-line';
  let prefix = '';
  if (line.startsWith('+')) { cls += ' diff-add'; prefix = '+'; }
  else if (line.startsWith('-')) { cls += ' diff-remove'; prefix = '−'; }
  else if (line.startsWith('@@')) { cls += ' diff-hunk'; }

  return (
    <div className={cls}>
      <span className="diff-prefix">{prefix}</span>
      <span className="diff-text">{line}</span>
    </div>
  );
}

/**
 * 增强版提交详情面板
 * 文件列表 + 高亮 diff + 元信息
 */
export default function CommitDetail({ commit, repoPath }) {
  const [diff, setDiff] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedFiles, setExpandedFiles] = useState({});

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

          {/* 文件列表 */}
          <div className="diff-file-list">
            {diffFiles.map((f, idx) => {
              const isExpanded = expandedFiles[f.file] !== false; // 默认展开第一个
              const actuallyExpanded = idx === 0 ? (expandedFiles[f.file] !== false) : !!expandedFiles[f.file];
              return (
                <div key={f.file} className="diff-file-item">
                  <div
                    className="diff-file-header"
                    onClick={() => toggleFile(f.file)}
                  >
                    <span className="diff-file-toggle">{actuallyExpanded ? '▼' : '▶'}</span>
                    <span className="diff-file-name">{f.file}</span>
                    <span className="diff-file-stats">
                      <span className="stat-added">+{f.added}</span>
                      <span className="stat-removed">−{f.removed}</span>
                    </span>
                  </div>
                  {actuallyExpanded && (
                    <div className="diff-file-content">
                      {f.hunks.map((hunk, hi) => (
                        <div key={hi} className="diff-hunk-block">
                          <div className="diff-hunk-header">{hunk.header}</div>
                          {hunk.lines.map((line, li) => (
                            <DiffLine key={li} line={line} />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="diff-empty">无变更内容（可能是初始提交）</div>
      )}
    </div>
  );
}
