/**
 * Diff 解析与渲染工具 — 共享模块
 * 供 CommitDetail、StageArea、FileBrowser 等组件复用
 */
import React from 'react';

export interface DiffHunk {
  header: string;
  lines: string[];
}

export interface DiffFile {
  file: string;
  header: string[];
  hunks: DiffHunk[];
  added: number;
  removed: number;
}

/**
 * 解析 diff 字符串，提取每个文件的变更
 */
export function parseDiffFiles(diffText: string): DiffFile[] {
  if (!diffText) return [];
  const files: DiffFile[] = [];
  const lines = diffText.split('\n');
  let currentFile: DiffFile | null = null;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      if (currentFile) files.push(currentFile);
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      currentFile = {
        file: match ? match[2] : '',
        header: [line],
        hunks: [],
        added: 0,
        removed: 0,
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
export function DiffLine({ line }: { line: string }) {
  let cls = 'diff-line';
  let prefix = '';
  if (line.startsWith('+')) {
    cls += ' diff-add';
    prefix = '+';
  } else if (line.startsWith('-')) {
    cls += ' diff-remove';
    prefix = '−';
  } else if (line.startsWith('@@')) {
    cls += ' diff-hunk';
  }

  return (
    <div className={cls}>
      <span className="diff-prefix">{prefix}</span>
      <span className="diff-text">{line}</span>
    </div>
  );
}

interface DiffViewerProps {
  files: DiffFile[];
  expandedFiles: Record<string, boolean | undefined>;
  toggleFile: (file: string) => void;
  emptyText?: string;
}

/**
 * Diff 文件列表视图 — 展开/折叠每个文件
 */
export function DiffViewer({
  files,
  expandedFiles,
  toggleFile,
  emptyText = '无变更内容',
}: DiffViewerProps) {
  if (files.length === 0) {
    return <div className="diff-empty">{emptyText}</div>;
  }

  return (
    <div className="diff-file-list">
      {files.map((f, idx) => {
        const isExpanded =
          idx === 0 ? expandedFiles[f.file] !== false : !!expandedFiles[f.file];
        return (
          <div key={f.file} className="diff-file-item">
            <div className="diff-file-header" onClick={() => toggleFile(f.file)}>
              <span className="diff-file-toggle">{isExpanded ? '▼' : '▶'}</span>
              <span className="diff-file-name">{f.file}</span>
              <span className="diff-file-stats">
                <span className="stat-added">+{f.added}</span>
                <span className="stat-removed">−{f.removed}</span>
              </span>
            </div>
            {isExpanded && (
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
  );
}
