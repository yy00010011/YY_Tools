/**
 * 测试 CommitGraph 中的 assignLanes 算法 和 CommitDetail 中的 parseDiffFiles
 * 需要从源文件中提取纯函数进行测试
 */

// ========== assignLanes 测试 ==========

// 重新实现 assignLanes（从 CommitGraph.jsx 提取，保持逻辑一致）
const COLORS = [
  '#e06c75', '#61afef', '#98c379', '#d19a66',
  '#c678dd', '#56b6c2', '#e5c07b', '#be5046',
  '#d55fde', '#528bff', '#f0c674', '#b5bd68'
];

function assignLanes(commits) {
  if (!commits || commits.length === 0) return commits;

  const ordered = [...commits].reverse();
  const commitData = new Map();
  const childCount = new Map();
  let nextLane = 0;
  let nextColor = 0;

  for (const commit of ordered) {
    let lane, color;

    if (commit.parents.length === 0) {
      lane = nextLane++;
      color = COLORS[nextColor % COLORS.length];
      nextColor++;
    } else {
      const firstParent = commit.parents[0];
      const parentInfo = commitData.get(firstParent);
      const count = childCount.get(firstParent) || 0;

      if (parentInfo && count === 0) {
        lane = parentInfo.lane;
        color = parentInfo.color;
      } else {
        lane = nextLane++;
        color = COLORS[nextColor % COLORS.length];
        nextColor++;
      }
      childCount.set(firstParent, count + 1);
    }

    commitData.set(commit.hash, { lane, color });
    commit._lane = lane;
    commit._color = color;
  }

  const maxLane = Math.max(...commits.map(c => c._lane || 0), 0);
  commits._maxLane = maxLane;
  return commits;
}

describe('assignLanes', () => {
  it('空数组直接返回', () => {
    const result = assignLanes([]);
    expect(result).toEqual([]);
  });

  it('单个根提交：lane=0', () => {
    const commits = [{ hash: 'a', parents: [], subject: 'initial' }];
    assignLanes(commits);
    expect(commits[0]._lane).toBe(0);
    expect(commits._maxLane).toBe(0);
  });

  it('线性历史：所有提交同一 lane', () => {
    const commits = [
      { hash: 'c', parents: ['b'], subject: 'third' },
      { hash: 'b', parents: ['a'], subject: 'second' },
      { hash: 'a', parents: [], subject: 'first' },
    ];
    assignLanes(commits);
    const lanes = commits.map(c => c._lane);
    expect(new Set(lanes).size).toBe(1); // 全部相同 lane
  });

  it('分支：不同分支分配不同 lane', () => {
    const commits = [
      { hash: 'c', parents: ['a'], subject: 'on branch' },   // 第二个 child of a → 新 lane
      { hash: 'b', parents: ['a'], subject: 'on main' },      // 第一个 child of a → 继承 lane
      { hash: 'a', parents: [], subject: 'root' },
    ];
    assignLanes(commits);
    // b 和 c 应在不同 lane（c 是 a 的第二个 child）
    expect(commits[1]._lane).not.toBe(commits[0]._lane);
  });

  it('合并提交：分支汇入', () => {
    const commits = [
      { hash: 'd', parents: ['b', 'c'], subject: 'merge' },
      { hash: 'c', parents: ['a'], subject: 'feature' },
      { hash: 'b', parents: ['a'], subject: 'main' },
      { hash: 'a', parents: [], subject: 'root' },
    ];
    assignLanes(commits);
    // d 的两个 parent 在不同 lane
    expect(commits[1]._lane).not.toBe(commits[2]._lane);
  });

  it('每个提交都有 _lane 和 _color', () => {
    const commits = [
      { hash: 'b', parents: ['a'], subject: 'second' },
      { hash: 'a', parents: [], subject: 'first' },
    ];
    assignLanes(commits);
    commits.forEach(c => {
      expect(c).toHaveProperty('_lane');
      expect(c).toHaveProperty('_color');
      expect(typeof c._lane).toBe('number');
      expect(typeof c._color).toBe('string');
    });
  });

  it('多个根提交应分配不同 lane', () => {
    const commits = [
      { hash: 'b', parents: [], subject: 'root2' },
      { hash: 'a', parents: [], subject: 'root1' },
    ];
    assignLanes(commits);
    expect(commits[0]._lane).not.toBe(commits[1]._lane);
  });
});

// ========== parseDiffFiles 测试 ==========

function parseDiffFiles(diffText) {
  if (!diffText) return [];
  const files = [];
  const lines = diffText.split('\n');
  let currentFile = null;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      if (currentFile) files.push(currentFile);
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      currentFile = {
        file: match ? match[2] : '',
        header: [line],
        hunks: [],
        added: 0,
        removed: 0
      };
    } else if (currentFile) {
      currentFile.header.push(line);
      if (line.startsWith('@@')) {
        currentFile.hunks.push({ header: line, lines: [] });
      } else if (currentFile.hunks.length > 0) {
        const hunk = currentFile.hunks[currentFile.hunks.length - 1];
        hunk.lines.push(line);
        if (line.startsWith('+')) currentFile.added++;
        else if (line.startsWith('-')) currentFile.removed++;
      }
    }
  }
  if (currentFile) files.push(currentFile);
  return files;
}

describe('parseDiffFiles', () => {
  it('空/假值输入返回空数组', () => {
    expect(parseDiffFiles('')).toEqual([]);
    expect(parseDiffFiles(null)).toEqual([]);
    expect(parseDiffFiles(undefined)).toEqual([]);
  });

  it('解析单文件 diff', () => {
    const diff = [
      'diff --git a/test.js b/test.js',
      'index 123..456 100644',
      '--- a/test.js',
      '+++ b/test.js',
      '@@ -1,3 +1,4 @@',
      ' unchanged',
      '+added line',
      '-removed line',
    ].join('\n');
    const result = parseDiffFiles(diff);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('test.js');
    expect(result[0].added).toBe(1);
    expect(result[0].removed).toBe(1);
    expect(result[0].hunks).toHaveLength(1);
  });

  it('解析多文件 diff', () => {
    const diff = [
      'diff --git a/a.js b/a.js',
      'index 111..222',
      '--- a/a.js',
      '+++ b/a.js',
      '@@ -1 +1 @@',
      '+a',
      'diff --git a/b.js b/b.js',
      'index 333..444',
      '--- a/b.js',
      '+++ b/b.js',
      '@@ -1 +1 @@',
      '-b',
    ].join('\n');
    const result = parseDiffFiles(diff);
    expect(result).toHaveLength(2);
    expect(result[0].file).toBe('a.js');
    expect(result[1].file).toBe('b.js');
  });

  it('空 diff（无文件变更）', () => {
    const diff = '';
    expect(parseDiffFiles(diff)).toEqual([]);
  });

  it('正确统计 added/removed', () => {
    const diff = [
      'diff --git a/x.js b/x.js',
      'index 111..222',
      '--- a/x.js',
      '+++ b/x.js',
      '@@ -1,4 +1,3 @@',
      '-line1',
      '-line2',
      '+newline',
    ].join('\n');
    const result = parseDiffFiles(diff);
    expect(result[0].added).toBe(1);
    expect(result[0].removed).toBe(2);
  });

  it('处理文件路径含空格的情况', () => {
    const diff = [
      'diff --git a/my file.js b/my file.js',
      'index 000..111',
      '--- a/my file.js',
      '+++ b/my file.js',
      '@@ -1 +1 @@',
      '+hello',
    ].join('\n');
    const result = parseDiffFiles(diff);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('my file.js');
  });

  it('处理无 hunk 的 diff（二进制文件等）', () => {
    const diff = [
      'diff --git a/image.png b/image.png',
      'index 123..456',
      'Binary files differ',
    ].join('\n');
    const result = parseDiffFiles(diff);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('image.png');
    expect(result[0].hunks).toHaveLength(0);
    expect(result[0].added).toBe(0);
    expect(result[0].removed).toBe(0);
  });

  it('处理新增文件 diff', () => {
    const diff = [
      'diff --git a/newfile.js b/newfile.js',
      'new file mode 100644',
      'index 0000000..abc1234',
      '--- /dev/null',
      '+++ b/newfile.js',
      '@@ -0,0 +1,3 @@',
      '+line1',
      '+line2',
      '+line3',
    ].join('\n');
    const result = parseDiffFiles(diff);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('newfile.js');
    expect(result[0].added).toBe(3);
    expect(result[0].removed).toBe(0);
  });

  it('处理删除文件 diff', () => {
    const diff = [
      'diff --git a/oldfile.js b/oldfile.js',
      'deleted file mode 100644',
      'index abc1234..0000000',
      '--- a/oldfile.js',
      '+++ /dev/null',
      '@@ -1,3 +0,0 @@',
      '-line1',
      '-line2',
      '-line3',
    ].join('\n');
    const result = parseDiffFiles(diff);
    expect(result).toHaveLength(1);
    expect(result[0].added).toBe(0);
    expect(result[0].removed).toBe(3);
  });

  it('处理多 hunk 单文件', () => {
    const diff = [
      'diff --git a/src.js b/src.js',
      'index 111..222',
      '--- a/src.js',
      '+++ b/src.js',
      '@@ -1,3 +1,4 @@',
      ' a',
      '+b',
      ' c',
      '@@ -10,2 +11,2 @@',
      '-x',
      '+y',
    ].join('\n');
    const result = parseDiffFiles(diff);
    expect(result[0].hunks).toHaveLength(2);
    expect(result[0].added).toBe(2);
    expect(result[0].removed).toBe(1);
  });
});

// ========== buildPaths 测试 ==========

describe('buildPaths 逻辑验证', () => {
  // 模拟 buildPaths 的核心逻辑（不依赖 SVG 坐标计算）
  function collectParentRelations(commits) {
    const relations = [];
    const hashToIdx = new Map();
    commits.forEach((c, i) => hashToIdx.set(c.hash, i));

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      for (const parentHash of commit.parents) {
        const parentIdx = hashToIdx.get(parentHash);
        if (parentIdx !== undefined) {
          relations.push({
            childIdx: i,
            parentIdx,
            sameLane: commit._lane === commits[parentIdx]._lane,
          });
        }
      }
    }
    return relations;
  }

  it('线性历史中所有边同 lane', () => {
    const commits = [
      { hash: 'c', parents: ['b'], subject: 'c', _lane: 0, _color: '#aaa' },
      { hash: 'b', parents: ['a'], subject: 'b', _lane: 0, _color: '#aaa' },
      { hash: 'a', parents: [], subject: 'a', _lane: 0, _color: '#aaa' },
    ];
    const relations = collectParentRelations(commits);
    expect(relations).toHaveLength(2);
    expect(relations.every(r => r.sameLane)).toBe(true);
  });

  it('分支间连接跨 lane', () => {
    const commits = [
      { hash: 'c', parents: ['a'], subject: 'c', _lane: 1, _color: '#bbb' },
      { hash: 'b', parents: ['a'], subject: 'b', _lane: 0, _color: '#aaa' },
      { hash: 'a', parents: [], subject: 'a', _lane: 0, _color: '#aaa' },
    ];
    const relations = collectParentRelations(commits);
    // b->a: 同 lane; c->a: 跨 lane
    const bToA = relations.find(r => r.childIdx === 1);
    const cToA = relations.find(r => r.childIdx === 0);
    expect(bToA.sameLane).toBe(true);
    expect(cToA.sameLane).toBe(false);
  });

  it('合并提交连接多个 parent', () => {
    const commits = [
      { hash: 'd', parents: ['b', 'c'], subject: 'd', _lane: 0, _color: '#aaa' },
      { hash: 'c', parents: ['a'], subject: 'c', _lane: 1, _color: '#bbb' },
      { hash: 'b', parents: ['a'], subject: 'b', _lane: 0, _color: '#aaa' },
      { hash: 'a', parents: [], subject: 'a', _lane: 0, _color: '#aaa' },
    ];
    const relations = collectParentRelations(commits);
    // d 有两个 parent 连接
    const dRelations = relations.filter(r => r.childIdx === 0);
    expect(dRelations).toHaveLength(2);
    // d->b: 同 lane; d->c: 跨 lane
    expect(dRelations.some(r => r.parentIdx === 1 && !r.sameLane)).toBe(true);
    expect(dRelations.some(r => r.parentIdx === 2 && r.sameLane)).toBe(true);
  });

  it('父提交不在视图中时不产生连接', () => {
    const commits = [
      { hash: 'b', parents: ['a'], subject: 'b', _lane: 0, _color: '#aaa' },
      // 'a' 不在 commits 中
    ];
    const relations = collectParentRelations(commits);
    expect(relations).toHaveLength(0);
  });
});
