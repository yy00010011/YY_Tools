import React, { useState, useEffect } from 'react';

/**
 * 主题切换按钮 — 深色/浅色模式
 * 通过 document.documentElement.dataset.theme 切换
 * 偏好持久化到 localStorage
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    // 读取保存的偏好（默认深色）
    const saved = localStorage.getItem('theme');
    const isDark = saved !== 'light';
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    const theme = next ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  };

  return (
    <button
      className="theme-toggle-btn"
      onClick={toggle}
      title={dark ? '切换到浅色主题' : '切换到深色主题'}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
