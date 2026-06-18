import { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../config';

/**
 * 通用 Git 操作 hook — 封装 POST 请求 + loading/error 状态 + 竞态保护
 * @param {string} repoPath 仓库路径
 * @returns {{ doAction, loading, error }}
 */
export default function useGitAction(repoPath) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  // 卸载时取消进行中的请求
  useEffect(() => {
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, []);

  /**
   * @param {string} endpoint API 路径，如 '/branch/create'
   * @param {object} [body={}] 请求体（不含 path，自动注入）
   * @param {(data: any, raw?: any) => void} [onSuccess] 成功回调，data.error 时 raw 携带完整响应
   */
  const doAction = async (endpoint, body = {}, onSuccess) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repoPath, ...body }),
        signal: controller.signal
      });
      const data = await res.json();
      if (data.error) {
        if (onSuccess) onSuccess(null, data);
        else throw new Error(data.error);
        return;
      }
      if (onSuccess) onSuccess(data);
      return data;
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  };

  return { doAction, loading, error };
}
