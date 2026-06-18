import React, { useState, useMemo } from 'react';

const HISTORY_KEY = 'git-viz-recent-paths';
const MAX_HISTORY = 5;

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveHistory(p) {
  const list = loadHistory().filter(item => item !== p);
  list.unshift(p);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
}

/**
 * 仓库路径输入组件
 */
export default function RepoInput({ onConnect, loading }) {
  const [path, setPath] = useState('');
  const history = useMemo(() => loadHistory(), []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const p = path.trim();
    if (p && !loading) {
      saveHistory(p);
      onConnect(p);
    }
  };

  return (
    <form className="repo-input" onSubmit={handleSubmit}>
      <input
        type="text"
        value={path}
        onChange={e => setPath(e.target.value)}
        placeholder="输入 Git 仓库路径，如 C:/project/repo 或 /home/user/repo"
        className="path-input"
        disabled={loading}
        list="repo-path-history"
      />
      {history.length > 0 && (
        <datalist id="repo-path-history">
          {history.map((p, i) => <option key={i} value={p} />)}
        </datalist>
      )}
      <button type="submit" className="connect-btn" disabled={loading || !path.trim()}>
        {loading ? '⏳ 加载中...' : '🔗 打开'}
      </button>
    </form>
  );
}
