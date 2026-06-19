import { execFileSync } from 'child_process';
import path from 'path';
import logger from './logger';
import type { Branch, Tag, Commit, FileStatus, Refs } from './types';

/**
 * Git 数据服务 - 封装 git 命令调用，返回结构化数据
 * 全部使用 execFileSync（非 shell 模式），参数数组传递，消除命令注入风险
 */

const BIG_BUFFER = 50 * 1024 * 1024;
const MED_BUFFER = 10 * 1024 * 1024;

/** 自定义错误类，携带 git stderr */
export class GitServiceError extends Error {
  stderr: string;
  constructor(message: string, stderr = '') {
    super(message);
    this.name = 'GitServiceError';
    this.stderr = stderr;
  }
}

/** 检查目录是否为有效的 Git 仓库 */
export function isGitRepo(repoPath: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd: repoPath, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/** 获取仓库中所有分支 */
export function getBranches(repoPath: string): Branch[] {
  try {
    const output = execFileSync('git', [
      'branch', '-a', '--format=%(refname:short)|%(objectname:short)|%(HEAD)'
    ], { cwd: repoPath, encoding: 'utf8', stdio: 'pipe' }).trim();
    return output.split('\n').filter(Boolean).map(line => {
      const [name, hash, head] = line.split('|');
      return { name: name.trim(), hash: hash.trim(), isHead: head === '*' };
    });
  } catch (err: any) {
    throw new GitServiceError(`获取分支列表失败: ${err.message}`, err.stderr || '');
  }
}

/** 获取所有标签 */
export function getTags(repoPath: string): Tag[] {
  try {
    const output = execFileSync('git', [
      'tag', '--format=%(refname:short)|%(objectname:short)'
    ], { cwd: repoPath, encoding: 'utf8', stdio: 'pipe' }).trim();
    return output.split('\n').filter(Boolean).map(line => {
      const [name, hash] = line.split('|');
      return { name: name.trim(), hash: hash.trim() };
    });
  } catch (err: any) {
    throw new GitServiceError(`获取标签列表失败: ${err.message}`, err.stderr || '');
  }
}

/**
 * 获取提交历史（核心方法）
 * 返回包含父子关系的结构化提交列表
 */
export function getCommitLog(repoPath: string, maxCount = 100, skip = 0): Commit[] {
  try {
    // 使用 %H 完整hash, %P 父提交hash, %an 作者, %ae 邮箱, %ai 时间, %s 标题, %d 引用名
    const format = '%H%n%P%n%an%n%ae%n%ai%n%s%n%d%n---';
    const args: string[] = [
      'log', `--max-count=${maxCount}`, `--format=${format}`, '--all', '--date-order'
    ];
    if (skip > 0) args.push(`--skip=${skip}`);
    const output = execFileSync('git', args, {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: BIG_BUFFER
    }).trim();

    const commits: Commit[] = [];
    const entries = output.split('\n---\n').filter(Boolean);

    for (const entry of entries) {
      const lines = entry.trim().split('\n');
      if (lines.length < 6) continue;

      const hash = lines[0].trim();
      const parents = lines[1].trim() ? lines[1].trim().split(' ') : [];
      const authorName = lines[2].trim();
      const authorEmail = lines[3].trim();
      const date = lines[4].trim();
      const subject = lines[5].trim();

      // 解析引用名称
      const refsStr = (lines[6] || '').trim();
      const refs = parseRefs(refsStr);

      commits.push({
        hash,
        shortHash: hash.substring(0, 7),
        parents,
        authorName,
        authorEmail,
        date,
        subject,
        refs
      });
    }

    return commits;
  } catch (err: any) {
    logger.error('获取提交历史失败', { err: err.message });
    throw new GitServiceError(`获取提交历史失败: ${err.message}`, err.stderr || '');
  }
}

/** 解析 git ref 字符串，如 "(HEAD -> main, origin/main)" */
export function parseRefs(refStr: string): Refs {
  if (!refStr || refStr === '') return { branches: [], tags: [], isHead: false };

  const refs: Refs = { branches: [], tags: [], isHead: false };
  const inner = (refStr.startsWith('(') && refStr.endsWith(')'))
    ? refStr.slice(1, -1).trim()
    : refStr.trim();
  if (!inner) return refs;

  const parts = inner.split(',').map(s => s.trim());

  for (const part of parts) {
    if (part.startsWith('tag:')) {
      refs.tags.push(part.replace('tag:', '').trim());
    } else {
      let branchName = part;
      if (branchName.startsWith('HEAD -> ')) {
        branchName = branchName.replace('HEAD -> ', '');
        refs.isHead = true;
      }
      refs.branches.push(branchName);
    }
  }

  return refs;
}

/** 获取单个提交的 diff */
export function getCommitDiff(repoPath: string, hash: string): string {
  try {
    return execFileSync('git', ['show', '--format=', hash], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
    });
  } catch (err: any) {
    throw new GitServiceError(`获取提交 diff 失败: ${err.message}`, err.stderr || '');
  }
}

/** 获取文件状态 (暂存区和工作区) */
export function getStatus(repoPath: string): FileStatus[] {
  try {
    const output = execFileSync('git', ['status', '--porcelain'], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe'
    }).trim();
    return output.split('\n').filter(Boolean).map(line => {
      const xy = line.substring(0, 2);
      const file = line.substring(3);
      let origFile: string | null = null;
      let displayFile = file;
      if (xy.startsWith('R')) {
        const arrowIdx = file.indexOf(' -> ');
        if (arrowIdx > 0) {
          origFile = file.substring(0, arrowIdx);
          displayFile = file.substring(arrowIdx + 4);
        }
      }
      const staged = xy[0] !== ' ' && xy[0] !== '?';
      const unstaged = xy[1] !== ' ';
      return {
        status: xy.trim(),
        file: displayFile,
        origFile,
        staged,
        unstaged,
        untracked: xy.startsWith('??'),
        added: xy[0] === 'A' || xy === '??',
        modified: xy[0] === 'M' || xy[1] === 'M',
        deleted: xy[0] === 'D' || xy[1] === 'D',
        renamed: xy.startsWith('R')
      };
    });
  } catch (err: any) {
    throw new GitServiceError(`获取文件状态失败: ${err.message}`, err.stderr || '');
  }
}

/** 获取当前分支名 */
export function getCurrentBranch(repoPath: string): string {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe'
    }).trim();
  } catch (err: any) {
    throw new GitServiceError(`获取当前分支失败: ${err.message}`, err.stderr || '');
  }
}

// ==================== 暂存/提交操作 ====================

/** 暂存文件 */
export function stageFiles(repoPath: string, files: string[]): FileStatus[] {
  execFileSync('git', ['add', '--', ...files], { cwd: repoPath, stdio: 'pipe' });
  return getStatus(repoPath);
}

/** 取消暂存 */
export function unstageFiles(repoPath: string, files: string[]): FileStatus[] {
  execFileSync('git', ['reset', 'HEAD', '--', ...files], { cwd: repoPath, stdio: 'pipe' });
  return getStatus(repoPath);
}

/** 丢弃工作区变更 */
export function discardFiles(repoPath: string, files: string[]): FileStatus[] {
  execFileSync('git', ['checkout', '--', ...files], { cwd: repoPath, stdio: 'pipe' });
  return getStatus(repoPath);
}

/** 提交 */
export function commit(repoPath: string, message: string, all = false): FileStatus[] {
  const args = all ? ['commit', '-a', '-m', message] : ['commit', '-m', message];
  execFileSync('git', args, { cwd: repoPath, stdio: 'pipe' });
  return getStatus(repoPath);
}

// ==================== 分支操作 ====================

/** 创建分支 */
export function createBranch(repoPath: string, name: string): Branch[] {
  execFileSync('git', ['branch', name], { cwd: repoPath, stdio: 'pipe' });
  return getBranches(repoPath);
}

/** 切换分支 */
export function switchBranch(repoPath: string, name: string): Branch[] {
  execFileSync('git', ['checkout', name], { cwd: repoPath, stdio: 'pipe' });
  return getBranches(repoPath);
}

/** 合并分支 */
export function mergeBranch(repoPath: string, name: string): { output: string; branches: Branch[] } {
  const output = execFileSync('git', ['merge', name, '--no-edit'], {
    cwd: repoPath, encoding: 'utf8', stdio: 'pipe'
  });
  return { output: output.trim(), branches: getBranches(repoPath) };
}

/** 删除分支 */
export function deleteBranch(repoPath: string, name: string, force = false): Branch[] {
  const flag = force ? '-D' : '-d';
  execFileSync('git', ['branch', flag, name], { cwd: repoPath, stdio: 'pipe' });
  return getBranches(repoPath);
}

/** 从远程分支检出本地分支 */
export function checkoutRemoteBranch(repoPath: string, remoteBranch: string): Branch[] {
  const localName = remoteBranch.replace(/^remotes\/[^/]+\//, '');
  try {
    execFileSync('git', ['checkout', '-b', localName, remoteBranch], { cwd: repoPath, stdio: 'pipe' });
  } catch (err: any) {
    throw new GitServiceError(`检出远程分支失败: ${err.message}`, err.stderr || '');
  }
  return getBranches(repoPath);
}

/** 删除远程分支 */
export function deleteRemoteBranch(repoPath: string, remote: string, branch: string): Branch[] {
  try {
    execFileSync('git', ['push', remote, '--delete', branch], { cwd: repoPath, stdio: 'pipe' });
  } catch (err: any) {
    throw new GitServiceError(formatRemoteError(err, remote, '删除远程分支'), err.stderr || '');
  }
  return getBranches(repoPath);
}

// ==================== 文件浏览 ====================

/** 获取指定提交的文件树 */
export function getFileTree(repoPath: string, hash = 'HEAD'): string[] {
  try {
    const output = execFileSync('git', ['ls-tree', '-r', '--name-only', hash], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe'
    }).trim();
    return output.split('\n').filter(Boolean);
  } catch (err: any) {
    throw new GitServiceError(`获取文件树失败: ${err.message}`, err.stderr || '');
  }
}

/** 获取指定提交中某个文件的内容 */
export function getFileContent(repoPath: string, hash: string, file: string): string {
  try {
    return execFileSync('git', ['show', `${hash}:${file}`], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
    });
  } catch (err: any) {
    throw new GitServiceError(`获取文件内容失败: ${err.message}`, err.stderr || '');
  }
}

/** 获取工作区未暂存的 diff */
export function getUnstagedDiff(repoPath: string): string {
  try {
    return execFileSync('git', ['diff'], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
    });
  } catch (err: any) {
    throw new GitServiceError(`获取未暂存 diff 失败: ${err.message}`, err.stderr || '');
  }
}

/** 获取已暂存的 diff */
export function getStagedDiff(repoPath: string): string {
  try {
    return execFileSync('git', ['diff', '--cached'], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
    });
  } catch (err: any) {
    throw new GitServiceError(`获取已暂存 diff 失败: ${err.message}`, err.stderr || '');
  }
}

// ==================== 远程操作 ====================

/** 获取当前分支领先远程的提交数（无 upstream 时返回 -1） */
export function getUnpushedCount(repoPath: string): number {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe'
    }).trim();
    // 检查是否有 upstream
    execFileSync('git', ['rev-parse', '--abbrev-ref', `${branch}@{u}`], {
      cwd: repoPath, stdio: 'pipe'
    });
    // 统计领先的提交数
    const count = execFileSync('git', ['rev-list', '--count', `${branch}@{u}..HEAD`], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe'
    }).trim();
    return parseInt(count, 10) || 0;
  } catch {
    return -1; // 无 upstream 或出错
  }
}

/** 推送到远程仓库 */
export function pushBranch(
  repoPath: string,
  remote = 'origin',
  branch?: string,
  tags = false,
  force = false
): string {
  const args = ['push', remote];
  if (branch) args.push(branch);
  if (tags) args.push('--tags');
  if (force) args.push('--force');
  try {
    const output = execFileSync('git', args, {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
    });
    return output.trim();
  } catch (err: any) {
    throw new GitServiceError(formatRemoteError(err, remote, '推送'), err.stderr || '');
  }
}

// ==================== 标签操作 ====================

/** 创建标签 */
export function createTag(repoPath: string, name: string, commit?: string): Tag[] {
  const args = ['tag', name];
  if (commit) args.push(commit);
  try {
    execFileSync('git', args, { cwd: repoPath, stdio: 'pipe' });
  } catch (err: any) {
    throw new GitServiceError(`创建标签失败: ${err.message}`, err.stderr || '');
  }
  return getTags(repoPath);
}

/** 删除标签 */
export function deleteTag(repoPath: string, name: string): Tag[] {
  try {
    execFileSync('git', ['tag', '-d', name], { cwd: repoPath, stdio: 'pipe' });
  } catch (err: any) {
    throw new GitServiceError(`删除标签失败: ${err.message}`, err.stderr || '');
  }
  return getTags(repoPath);
}

// ==================== Fetch / Pull ====================

/** 格式化远程操作错误，识别常见场景 */
function formatRemoteError(err: any, remote: string, action: string): string {
  const stderr: string = err.stderr || '';
  if (stderr.includes('does not appear to be a git repository')) {
    return `未配置远程仓库 "${remote}"。请先执行 git remote add ${remote} <url> 添加远程地址`;
  }
  if (stderr.includes('Could not read from remote repository')) {
    return `无法访问远程仓库 "${remote}"，请检查网络连接和访问权限`;
  }
  if (stderr.includes('Permission denied')) {
    return `远程仓库 "${remote}" 访问被拒绝，请检查 SSH Key 或用户名密码`;
  }
  return `${action}失败: ${err.message}`;
}

/** 从远程获取更新 */
export function fetchRemote(repoPath: string, remote = 'origin'): string {
  try {
    const output = execFileSync('git', ['fetch', remote], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
    });
    return output.trim();
  } catch (err: any) {
    throw new GitServiceError(formatRemoteError(err, remote, '获取'), err.stderr || '');
  }
}

/** 拉取并合并远程分支 */
export function pullBranch(repoPath: string, remote = 'origin', branch?: string): string {
  const args = ['pull', remote];
  if (branch) args.push(branch);
  try {
    const output = execFileSync('git', args, {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
    });
    return output.trim();
  } catch (err: any) {
    throw new GitServiceError(formatRemoteError(err, remote, '拉取'), err.stderr || '');
  }
}

// ==================== 远程仓库管理 ====================

/** 获取所有远程仓库列表 */
export function getRemotes(repoPath: string): { name: string; url: string; fetch: boolean; push: boolean }[] {
  try {
    const output = execFileSync('git', ['remote', '-v'], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe',
    }).trim();
    if (!output) return [];
    const remotes: Record<string, { name: string; url: string; fetch: boolean; push: boolean }> = {};
    for (const line of output.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) continue;
      const name = parts[0];
      const url = parts[1];
      const type = parts[2].replace(/[()]/g, ''); // (fetch) or (push)
      if (!remotes[name]) {
        remotes[name] = { name, url, fetch: false, push: false };
      }
      if (type === 'fetch') { remotes[name].url = url; remotes[name].fetch = true; }
      if (type === 'push') remotes[name].push = true;
    }
    return Object.values(remotes);
  } catch (err: any) {
    throw new GitServiceError(`获取远程仓库列表失败: ${err.message}`, err.stderr || '');
  }
}

/** 添加远程仓库（若已存在则更新 URL） */
export function addRemote(repoPath: string, name: string, url: string): string {
  try {
    // 先尝试 set-url（当 remote 已存在时）
    try {
      execFileSync('git', ['remote', 'set-url', name, url], {
        cwd: repoPath, stdio: 'pipe',
      });
      return `已更新远程仓库 "${name}" 的地址`;
    } catch {
      // 不存在则添加
      execFileSync('git', ['remote', 'add', name, url], {
        cwd: repoPath, stdio: 'pipe',
      });
      return `已添加远程仓库 "${name}" → ${url}`;
    }
  } catch (err: any) {
    throw new GitServiceError(`添加远程仓库失败: ${err.message}`, err.stderr || '');
  }
}

// ==================== Stash ====================

export interface StashEntry {
  index: number;
  branch: string;
  message: string;
  hash: string;
}

/** 获取 stash 列表 */
export function stashList(repoPath: string): StashEntry[] {
  try {
    const output = execFileSync('git', [
      'stash', 'list', '--format=%gd|%gs|%H'
    ], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe'
    }).trim();
    return output.split('\n').filter(Boolean).map(line => {
      const [ref, message, hash] = line.split('|');
      return {
        index: parseInt(ref.replace(/[^0-9]/g, '')) || 0,
        branch: '',
        message: message || '',
        hash: hash || ''
      };
    });
  } catch (err: any) {
    throw new GitServiceError(`获取 stash 列表失败: ${err.message}`, err.stderr || '');
  }
}

/** 暂存当前工作区 */
export function stashPush(repoPath: string, message?: string): StashEntry[] {
  const args = ['stash', 'push'];
  if (message) args.push('-m', message);
  execFileSync('git', args, { cwd: repoPath, stdio: 'pipe' });
  return stashList(repoPath);
}

/** 弹出最近的 stash */
export function stashPop(repoPath: string, index?: number): StashEntry[] {
  const ref = index != null ? `stash@{${index}}` : undefined;
  const args = ['stash', 'pop'];
  if (ref) args.push(ref);
  execFileSync('git', args, { cwd: repoPath, stdio: 'pipe' });
  return stashList(repoPath);
}

/** 应用 stash（不删除） */
export function stashApply(repoPath: string, index?: number): StashEntry[] {
  const ref = index != null ? `stash@{${index}}` : undefined;
  const args = ['stash', 'apply'];
  if (ref) args.push(ref);
  execFileSync('git', args, { cwd: repoPath, stdio: 'pipe' });
  return stashList(repoPath);
}

/** 删除 stash */
export function stashDrop(repoPath: string, index?: number): StashEntry[] {
  const ref = index != null ? `stash@{${index}}` : undefined;
  const args = ['stash', 'drop'];
  if (ref) args.push(ref);
  execFileSync('git', args, { cwd: repoPath, stdio: 'pipe' });
  return stashList(repoPath);
}

// ==================== Blame / 文件历史 ====================

export interface BlameLine {
  hash: string;
  shortHash: string;
  author: string;
  time: string;
  lineNo: number;
  content: string;
}

/** 获取文件的 blame 信息 */
export function getBlame(repoPath: string, file: string, hash = 'HEAD'): BlameLine[] {
  try {
    const output = execFileSync('git', [
      'blame', '--porcelain', hash, '--', file
    ], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
    });
    const lines: BlameLine[] = [];
    const rawLines = output.split('\n');
    let i = 0;
    while (i < rawLines.length) {
      const header = rawLines[i];
      if (!header || !/^[0-9a-f]{40}/.test(header)) { i++; continue; }
      const parts = header.split(' ');
      const hashVal = parts[0];
      const lineNo = parseInt(parts[2]) || 0;
      let author = '';
      let time = '';
      // 读取 porcelain 格式的元数据行
      while (++i < rawLines.length) {
        const meta = rawLines[i];
        if (meta.startsWith('author ')) author = meta.substring(7);
        else if (meta.startsWith('author-time ')) time = meta.substring(12);
        else if (meta.startsWith('\t')) {
          lines.push({
            hash: hashVal,
            shortHash: hashVal.substring(0, 7),
            author,
            time,
            lineNo,
            content: meta.substring(1)
          });
          i++;
          break;
        }
      }
    }
    return lines;
  } catch (err: any) {
    throw new GitServiceError(`获取 blame 失败: ${err.message}`, err.stderr || '');
  }
}

/** 获取文件的提交历史 */
export function getFileLog(repoPath: string, file: string, maxCount = 50): Commit[] {
  try {
    const format = '%H%n%P%n%an%n%ae%n%ai%n%s%n%d%n---';
    const output = execFileSync('git', [
      'log', `--max-count=${maxCount}`, `--format=${format}`, '--', file
    ], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: BIG_BUFFER
    }).trim();

    const commits: Commit[] = [];
    const entries = output.split('\n---\n').filter(Boolean);
    for (const entry of entries) {
      const commitLines = entry.trim().split('\n');
      if (commitLines.length < 6) continue;
      const hashVal = commitLines[0].trim();
      const parents = commitLines[1].trim() ? commitLines[1].trim().split(' ') : [];
      commits.push({
        hash: hashVal,
        shortHash: hashVal.substring(0, 7),
        parents,
        authorName: commitLines[2].trim(),
        authorEmail: commitLines[3].trim(),
        date: commitLines[4].trim(),
        subject: commitLines[5].trim(),
        refs: { branches: [], tags: [], isHead: false }
      });
    }
    return commits;
  } catch (err: any) {
    throw new GitServiceError(`获取文件历史失败: ${err.message}`, err.stderr || '');
  }
}

// ==================== 分支对比 ====================

/** 对比两个分支的差异（三点语法：自分叉以来的变更） */
export function compareBranches(repoPath: string, base: string, compare: string): string {
  try {
    return execFileSync('git', ['diff', `${base}...${compare}`], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
    });
  } catch (err: any) {
    throw new GitServiceError(`分支对比失败: ${err.message}`, err.stderr || '');
  }
}

// ==================== Cherry-Pick / Revert ====================

/** Cherry-pick 一个提交 */
export function cherryPickCommit(repoPath: string, hash: string): string {
  try {
    return execFileSync('git', ['cherry-pick', hash], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
    }).trim();
  } catch (err: any) {
    // 如果冲突，尝试 abort
    try { execFileSync('git', ['cherry-pick', '--abort'], { cwd: repoPath, stdio: 'pipe' }); } catch {}
    throw new GitServiceError(`Cherry-pick 失败: ${err.message}`, err.stderr || '');
  }
}

/** Revert 一个提交 */
export function revertCommit(repoPath: string, hash: string): string {
  try {
    return execFileSync('git', ['revert', '--no-edit', hash], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
    }).trim();
  } catch (err: any) {
    try { execFileSync('git', ['revert', '--abort'], { cwd: repoPath, stdio: 'pipe' }); } catch {}
    throw new GitServiceError(`Revert 失败: ${err.message}`, err.stderr || '');
  }
}

// ==================== Rebase ====================

/** Rebase 当前分支到指定分支上 */
export function rebaseBranch(repoPath: string, onto: string): string {
  try {
    return execFileSync('git', ['rebase', onto], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
    }).trim();
  } catch (err: any) {
    // 冲突时尝试 abort
    try { execFileSync('git', ['rebase', '--abort'], { cwd: repoPath, stdio: 'pipe' }); } catch {}
    throw new GitServiceError(`Rebase 失败（已自动 abort）: ${err.message}`, err.stderr || '');
  }
}

/** Abort 进行中的 rebase */
export function rebaseAbort(repoPath: string): string {
  return execFileSync('git', ['rebase', '--abort'], {
    cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
  }).trim();
}

/** Continue 进行中的 rebase（解决冲突后） */
export function rebaseContinue(repoPath: string): string {
  return execFileSync('git', ['rebase', '--continue'], {
    cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
  }).trim();
}

// ==================== 提交推送 & 版本切换 ====================

/**
 * 将指定提交推送到远程分支
 * 等价于 git push <remote> <commit>:refs/heads/<branch>
 */
export function pushCommit(
  repoPath: string,
  commitHash: string,
  remote: string,
  branch: string,
  force = false,
): string {
  const ref = `refs/heads/${branch}`;
  const args = ['push', remote, `${commitHash}:${ref}`];
  if (force) args.push('--force');
  try {
    const output = execFileSync('git', args, {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER,
    });
    return output.trim();
  } catch (err: any) {
    throw new GitServiceError(
      `推送提交到 ${remote}/${branch} 失败: ${err.stderr || err.message}`,
      err.stderr || '',
    );
  }
}

/**
 * 检出某个历史提交（detached HEAD）
 * 等价于 git checkout <hash>
 */
export function checkoutCommit(repoPath: string, hash: string): string {
  try {
    const output = execFileSync('git', ['checkout', hash], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER,
    });
    return output.trim();
  } catch (err: any) {
    throw new GitServiceError(`检出提交失败: ${err.stderr || err.message}`, err.stderr || '');
  }
}

/**
 * 将当前分支重置到指定提交
 * @param hard - true 时使用 --hard（丢弃工作区变更），false 时使用 --soft（保留工作区）
 */
export function resetToCommit(repoPath: string, hash: string, hard: boolean): string {
  const flag = hard ? '--hard' : '--soft';
  try {
    const output = execFileSync('git', ['reset', flag, hash], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER,
    });
    return output.trim();
  } catch (err: any) {
    throw new GitServiceError(`重置失败: ${err.stderr || err.message}`, err.stderr || '');
  }
}

/**
 * 删除（丢弃）某个历史提交
 * 使用 git rebase --onto <hash>^ <hash> <branch> 跳过目标提交
 */
export function dropCommit(repoPath: string, hash: string): string {
  try {
    // 获取当前分支名
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe',
    }).trim();

    if (branch === 'HEAD') {
      throw new GitServiceError('当前处于 detached HEAD 状态，无法删除提交。请先切换到一个分支');
    }

    // 使用 rebase --onto 跳过目标提交
    // <hash>^ 是目标提交的父提交
    const output = execFileSync('git', ['rebase', '--onto', `${hash}^`, hash, branch], {
      cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER,
    });
    return output.trim();
  } catch (err: any) {
    // 冲突时自动 abort
    try {
      execFileSync('git', ['rebase', '--abort'], { cwd: repoPath, stdio: 'pipe' });
    } catch {}
    throw new GitServiceError(
      `删除提交失败（已自动撤销）: ${err.stderr || err.message}`,
      err.stderr || '',
    );
  }
}
