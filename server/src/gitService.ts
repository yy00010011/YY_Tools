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
  const output = execFileSync('git', args, {
    cwd: repoPath, encoding: 'utf8', stdio: 'pipe', maxBuffer: MED_BUFFER
  });
  return output.trim();
}
