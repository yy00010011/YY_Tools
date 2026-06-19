/**
 * 共享校验函数 — 路由层共用
 */
import path from 'path';
import fs from 'fs';

const ALLOWED_ROOTS = (process.env.ALLOWED_ROOTS || '')
  .split(path.delimiter)
  .filter(Boolean);

const HASH_RE = /^[a-zA-Z0-9_\-./^~]{4,64}$/;

/** 分支/标签名：允许字母、数字、连字符、下划线、斜线、点，最长 256 */
const REF_NAME_RE = /^[a-zA-Z0-9_\-./]{1,256}$/;

/** 文件名校验：不允许以 - 开头（防止被误解析为 CLI 选项），不允许路径遍历 */
const SAFE_FILE_RE = /^(?!-)[^\0]{1,4096}$/;
const PATH_TRAVERSAL_RE = /\.\./;

export function validateHash(hash: string): boolean {
  return HASH_RE.test(hash);
}

/** 校验 ref 名称（分支/标签） */
export function validateRefName(name: unknown): name is string {
  return typeof name === 'string' && REF_NAME_RE.test(name);
}

/** 校验提交消息（非空，≤10KB） */
export function validateCommitMessage(msg: unknown): msg is string {
  return typeof msg === 'string' && msg.length > 0 && msg.length <= 10240;
}

/** 校验文件名，防止路径遍历和选项注入 */
export function validateFileName(file: unknown): file is string {
  if (typeof file !== 'string' || !SAFE_FILE_RE.test(file)) return false;
  return !PATH_TRAVERSAL_RE.test(file);
}

/** 校验文件列表 */
export function validateFileList(files: unknown): files is string[] {
  return Array.isArray(files) && files.length > 0 && files.every((f) => typeof f === 'string' && f.length > 0);
}

/** 校验 remote 名称 */
export function validateRemoteName(remote: unknown): remote is string {
  return typeof remote === 'string' && remote.length > 0 && REF_NAME_RE.test(remote);
}

/**
 * 校验并解析仓库路径。
 * - 路径存在
 * - 在 ALLOWED_ROOTS 白名单内（如果配置了）
 * 返回规范化的绝对路径，校验失败返回 null。
 */
export function validateRepoPath(repoPath: unknown): string | null {
  if (!repoPath || typeof repoPath !== 'string') return null;
  const resolved = path.resolve(repoPath);
  if (!fs.existsSync(resolved)) return null;
  if (ALLOWED_ROOTS.length > 0) {
    const allowed = ALLOWED_ROOTS.some((root) => {
      const r = path.resolve(root);
      return resolved === r || resolved.startsWith(r + path.sep);
    });
    if (!allowed) return null;
  }
  return resolved;
}
