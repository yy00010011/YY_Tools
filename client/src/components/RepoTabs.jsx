import React from 'react';

/**
 * 多仓库标签栏
 */
export default function RepoTabs({ tabs, activeIndex, onSelect, onClose }) {
  if (!tabs || tabs.length <= 1) return null;

  return (
    <div className="repo-tabs">
      {tabs.map((tab, i) => (
        <div
          key={tab.path}
          className={`repo-tab ${i === activeIndex ? 'active' : ''}`}
          onClick={() => onSelect(i)}
        >
          <span className="repo-tab-label">📁 {tab.label}</span>
          <span
            className="repo-tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(i);
            }}
            title="关闭仓库"
          >✕</span>
        </div>
      ))}
    </div>
  );
}
