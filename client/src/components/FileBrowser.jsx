import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE } from '../config';

/**
 * 文件浏览器 — 展示指定提交的文件树，支持点击查看文件内容
 * @param {{ repoPath: string, hash: string }} props
 */
export default function FileBrowser({ repoPath, hash }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedDirs, setExpandedDirs] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);

  /** 加载文件树 */
  useEffect(() => {
    if (!repoPath || !hash) return;
    setLoading(true);
    setError('');
    setSelectedFile(null);
    setExpandedDirs({});
    const controller = new AbortController();
    fetch(`${API_BASE}/git/tree?path=${encodeURIComponent(repoPath)}&hash=${encodeURIComponent(hash)}`, {
      signal: controller.signal
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setFiles(data.files || []);
        setLoading(false);
      })
      .catch(e => {
        if (e.name !== 'AbortError') { setError(e.message); setLoading(false); }
      });
    return () => controller.abort();
  }, [repoPath, hash]);

  /** 构建树形结构 */
  const tree = useMemo(() => buildTree(files), [files]);

  /** 点击文件，加载内容 */
  const handleFileClick = useCallback(async (filePath) => {
    setSelectedFile(filePath);
    setLoadingContent(true);
    const controller = new AbortController();
    try {
      const res = await fetch(
        `${API_BASE}/git/file?path=${encodeURIComponent(repoPath)}&hash=${encodeURIComponent(hash)}&file=${encodeURIComponent(filePath)}`,
        { signal: controller.signal }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFileContent(data.content || '');
    } catch (e) {
      if (e.name !== 'AbortError') setFileContent(`// 无法加载文件: ${e.message}`);
    } finally {
      setLoadingContent(false);
    }
  }, [repoPath, hash]);

  const toggleDir = (dir) => {
    setExpandedDirs(prev => ({ ...prev, [dir]: !prev[dir] }));
  };

  if (loading) {
    return <div className="diff-loading">⏳ 加载文件树...</div>;
  }

  if (error) {
    return <div className="stage-error">{error}</div>;
  }

  return (
    <div className="file-browser">
      <div className="file-browser-panels">
        {/* 文件树面板 */}
        <div className="file-browser-tree">
          <h4 className="file-browser-title">📁 文件 ({files.length})</h4>
          {tree.length === 0 ? (
            <div className="diff-empty">此提交无文件</div>
          ) : (
            <TreeNode
              nodes={tree}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              selectedFile={selectedFile}
              onFileClick={handleFileClick}
            />
          )}
        </div>

        {/* 文件内容面板 */}
        {selectedFile && (
          <div className="file-browser-content">
            <div className="file-browser-content-header">
              <span className="file-browser-content-name">📄 {selectedFile}</span>
            </div>
            {loadingContent ? (
              <div className="diff-loading">⏳ 加载内容...</div>
            ) : (
              <pre className="file-browser-code">{fileContent}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 将扁平文件路径列表转换为树形结构
 */
function buildTree(fileList) {
  const root = {};

  for (const filePath of fileList) {
    const parts = filePath.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (!current[part]) {
        current[part] = isLast ? { __file: filePath } : { __children: {} };
      }
      if (!isLast) {
        current = current[part].__children;
      }
    }
  }

  return treeFromMap(root, '');
}

function treeFromMap(map, prefix) {
  const items = [];
  const names = Object.keys(map).sort((a, b) => {
    const aIsDir = !!map[a].__children;
    const bIsDir = !!map[b].__children;
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });

  for (const name of names) {
    const entry = map[name];
    const fullPath = prefix ? `${prefix}/${name}` : name;
    if (entry.__children) {
      items.push({
        name,
        path: fullPath,
        isDir: true,
        children: treeFromMap(entry.__children, fullPath)
      });
    } else {
      items.push({
        name,
        path: entry.__file || fullPath,
        isDir: false
      });
    }
  }

  return items;
}

/**
 * 递归渲染树节点
 */
function TreeNode({ nodes, expandedDirs, toggleDir, selectedFile, onFileClick, depth = 0 }) {
  return (
    <ul className="file-tree-list">
      {nodes.map(node => (
        <li key={node.path} className={`file-tree-item ${node.isDir ? 'dir' : 'file'} ${selectedFile === node.path ? 'selected' : ''}`}>
          {node.isDir ? (
            <>
              <div
                className="file-tree-row"
                style={{ paddingLeft: depth * 16 + 4 }}
                onClick={() => toggleDir(node.path)}
              >
                <span className="file-tree-toggle">{expandedDirs[node.path] ? '▼' : '▶'}</span>
                <span className="file-tree-icon">📁</span>
                <span className="file-tree-name">{node.name}/</span>
              </div>
              {expandedDirs[node.path] && (
                <TreeNode
                  nodes={node.children}
                  expandedDirs={expandedDirs}
                  toggleDir={toggleDir}
                  selectedFile={selectedFile}
                  onFileClick={onFileClick}
                  depth={depth + 1}
                />
              )}
            </>
          ) : (
            <div
              className="file-tree-row"
              style={{ paddingLeft: depth * 16 + 20 }}
              onClick={() => onFileClick(node.path)}
            >
              <span className="file-tree-icon">📄</span>
              <span className="file-tree-name">{node.name}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
