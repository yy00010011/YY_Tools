/**
 * 核心类型定义 — 前后端共享的数据结构
 */

/** 提交引用的分支/标签信息 */
export interface Refs {
  branches: string[];
  tags: string[];
  isHead: boolean;
}

/** 提交对象 */
export interface Commit {
  hash: string;
  shortHash: string;
  parents: string[];
  authorName: string;
  authorEmail: string;
  date: string;
  subject: string;
  refs: Refs;
  /** 前端分配：轨道编号 */
  _lane?: number;
  /** 前端分配：颜色 */
  _color?: string;
}

/** 分支 */
export interface Branch {
  name: string;
  hash: string;
  isHead: boolean;
}

/** 标签 */
export interface Tag {
  name: string;
  hash: string;
}

/** 文件状态条目 */
export interface FileStatus {
  status: string;
  file: string;
  origFile: string | null;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  added: boolean;
  modified: boolean;
  deleted: boolean;
  renamed: boolean;
}

/** 提交图谱中一条连线 */
export interface GraphPath {
  d: string;
  color: string;
  key: string;
}

/** Diff 文件解析结果 */
export interface DiffFile {
  file: string;
  header: string[];
  hunks: DiffHunk[];
  added: number;
  removed: number;
}

export interface DiffHunk {
  header: string;
  lines: string[];
}

/** 仓库基本信息 */
export interface RepoInfo {
  path: string;
  name: string;
  isValid: boolean;
}

/** GET /api/git/log 响应 */
export interface LogResponse {
  commits: Commit[];
  branches: Branch[];
  tags: Tag[];
}

/** GET /api/git/status 响应 */
export interface StatusResponse {
  files: FileStatus[];
  currentBranch: string;
}

/** POST 操作通用响应 */
export interface ActionResponse {
  files?: FileStatus[];
  branches?: Branch[];
  commits?: Commit[];
  tags?: Tag[];
  currentBranch?: string;
  output?: string;
}

/** API 错误响应 */
export interface ApiError {
  error: string;
  stderr?: string;
}
