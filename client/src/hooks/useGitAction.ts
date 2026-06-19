import { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../config';

type OnSuccess<T = unknown> = (data: T, raw?: { error: string }) => void;

/**
 * 通用 Git 操作 hook — 封装 POST 请求 + loading/error 状态 + 竞态保护
 */
export default function useGitAction(repoPath: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // 卸载时取消进行中的请求
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  /**
   * @param endpoint API 路径，如 '/branch/create'
   * @param body     请求体（不含 path，自动注入）
   * @param onSuccess 成功回调
   */
  const doAction = async (
    endpoint: string,
    body: Record<string, unknown> = {},
    onSuccess?: OnSuccess,
  ) => {
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
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.error) {
        if (onSuccess) onSuccess(null, data);
        else throw new Error(data.error);
        return;
      }
      if (onSuccess) onSuccess(data);
      return data;
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') setError(e.message);
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  };

  return { doAction, loading, error };
}
