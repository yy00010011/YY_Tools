/**
 * API 客户端 — 集中管理所有后端请求
 * 统一 URL 拼接、错误处理、返回类型
 */
import { API_BASE } from './config';

// ---- 通用请求 ----

async function get<T = any>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data as T;
}

async function post<T = any>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data as T;
}

// ---- 仓库 ----

export const repoApi = {
  health: () => get<{ status: string; uptime: number }>('/health'),
  info: (path: string) =>
    get<{ path: string; name: string; isValid: boolean }>('/repo/info', { path }),
};

// ---- 提交 ----

export const commitApi = {
  log: (path: string, max = 50, skip = 0) =>
    get<any>('/git/log', { path, max: String(max), skip: String(skip) }),
  diff: (path: string, hash: string) =>
    get<{ diff: string }>('/git/diff', { path, hash }),
  blame: (path: string, file: string, hash = 'HEAD') =>
    get<any>('/git/blame', { path, file, hash }),
  fileLog: (path: string, file: string, max = 50) =>
    get<any>('/git/file-log', { path, file, max: String(max) }),
};

// ---- 暂存 & 提交 ----

export const stagingApi = {
  status: (path: string) => get<any>('/git/status', { path }),
  stage: (path: string, files: string[]) =>
    post<any>('/git/stage', { path, files }),
  unstage: (path: string, files: string[]) =>
    post<any>('/git/unstage', { path, files }),
  discard: (path: string, files: string[]) =>
    post<any>('/git/discard', { path, files }),
  commit: (path: string, message: string, all = false) =>
    post<any>('/git/commit', { path, message, all }),
};

// ---- 分支 & 标签 ----

export const branchApi = {
  create: (path: string, name: string) =>
    post<any>('/branch/create', { path, name }),
  switch: (path: string, name: string) =>
    post<any>('/branch/switch', { path, name }),
  merge: (path: string, name: string) =>
    post<any>('/branch/merge', { path, name }),
  delete: (path: string, name: string, force = false) =>
    post<any>('/branch/delete', { path, name, force }),
  checkoutRemote: (path: string, remoteBranch: string) =>
    post<any>('/branch/checkout-remote', { path, remoteBranch }),
  deleteRemote: (path: string, remote: string, branch: string) =>
    post<any>('/branch/delete-remote', { path, remote, branch }),
};

export const tagApi = {
  create: (path: string, name: string, commit?: string) =>
    post<any>('/tag/create', { path, name, commit }),
  delete: (path: string, name: string) =>
    post<any>('/tag/delete', { path, name }),
};

// ---- 远程 ----

export const remoteApi = {
  unpushedCount: (path: string) =>
    get<{ count: number }>('/git/unpushed-count', { path }),
  push: (path: string, opts: { remote?: string; branch?: string; tags?: boolean; force?: boolean } = {}) =>
    post<any>('/git/push', { path, ...opts }),
  fetch: (path: string, remote?: string) =>
    post<any>('/git/fetch', { path, remote }),
  pull: (path: string, remote?: string, branch?: string) =>
    post<any>('/git/pull', { path, remote, branch }),
};

// ---- 文件 ----

export const fileApi = {
  tree: (path: string, hash = 'HEAD') =>
    get<any>('/git/tree', { path, hash }),
  content: (path: string, file: string, hash = 'HEAD') =>
    get<any>('/git/file', { path, file, hash }),
  diffUnstaged: (path: string) =>
    get<{ diff: string }>('/git/diff-unstaged', { path }),
  diffStaged: (path: string) =>
    get<{ diff: string }>('/git/diff-staged', { path }),
};

// ---- Stash ----

export const stashApi = {
  list: (path: string) => get<any>('/git/stash-list', { path }),
  push: (path: string, message?: string) =>
    post<any>('/git/stash-push', { path, message }),
  pop: (path: string, index?: number) =>
    post<any>('/git/stash-pop', { path, index }),
  apply: (path: string, index?: number) =>
    post<any>('/git/stash-apply', { path, index }),
  drop: (path: string, index?: number) =>
    post<any>('/git/stash-drop', { path, index }),
};

// ---- 高级 ----

export const advancedApi = {
  compare: (path: string, base: string, compare: string) =>
    get<{ diff: string }>('/git/compare', { path, base, compare }),
  cherryPick: (path: string, hash: string) =>
    post<any>('/git/cherry-pick', { path, hash }),
  revert: (path: string, hash: string) =>
    post<any>('/git/revert', { path, hash }),
  rebase: (path: string, onto: string) =>
    post<any>('/git/rebase', { path, onto }),
  rebaseAbort: (path: string) =>
    post<any>('/git/rebase-abort', { path }),
  rebaseContinue: (path: string) =>
    post<any>('/git/rebase-continue', { path }),
};
