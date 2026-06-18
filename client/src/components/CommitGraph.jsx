import React, { useMemo, memo } from 'react';

const ROW_HEIGHT = 34;      // 每行高度
const LANE_WIDTH = 22;      // 每条分支线宽度
const DOT_RADIUS = 5;       // 提交点半径
const LARGE_REPO_THRESHOLD = 200; // 超过此数量的提交将显示性能提示
const COLORS = [
  '#e06c75', '#61afef', '#98c379', '#d19a66',
  '#c678dd', '#56b6c2', '#e5c07b', '#be5046',
  '#d55fde', '#528bff', '#f0c674', '#b5bd68'
];

/** 用 Canvas 精确测量 monospace 文本宽度（px），带缓存避免重复测量 */
let _measureCtx = null;
const _measureCache = new Map();
const MAX_CACHE_SIZE = 200;

function measureText(text) {
  // 命中缓存
  const cached = _measureCache.get(text);
  if (cached !== undefined) return cached;

  if (!_measureCtx) {
    const canvas = document.createElement('canvas');
    _measureCtx = canvas.getContext('2d');
    _measureCtx.font = '10px monospace';
  }
  const width = _measureCtx.measureText(text).width;

  // 缓存管理：超出上限时清空一半
  if (_measureCache.size >= MAX_CACHE_SIZE) {
    const keys = [..._measureCache.keys()];
    for (let i = 0; i < keys.length / 2; i++) {
      _measureCache.delete(keys[i]);
    }
  }
  _measureCache.set(text, width);
  return width;
}

/**
 * 为提交分配分支轨道（lane）
 * 核心算法：从旧到新处理提交。
 * - 根提交（无 parent）：分配新轨道
 * - 是某个 parent 的第一个 child：继承 parent 的轨道
 * - 是某个 parent 的第 N（N>1）个 child：开新轨道（分支点）
 * - 合并提交（2+ 个 parent）：占第一个 parent 的轨道，其余 parent 轨道"汇入"
 */
function assignLanes(commits) {
  if (!commits || commits.length === 0) return commits;

  // 从旧到新处理
  const ordered = [...commits].reverse();
  const commitData = new Map();    // hash -> { lane, color }
  const childCount = new Map();    // parentHash -> 已处理 child 个数
  let nextLane = 0;
  let nextColor = 0;

  for (const commit of ordered) {
    let lane, color;

    if (commit.parents.length === 0) {
      // 根提交：无父提交，分配新轨道
      lane = nextLane++;
      color = COLORS[nextColor % COLORS.length];
      nextColor++;
    } else {
      const firstParent = commit.parents[0];
      const parentInfo = commitData.get(firstParent);
      const count = childCount.get(firstParent) || 0;

      if (parentInfo && count === 0) {
        // 是该 parent 的第一个 child → 继承轨道
        lane = parentInfo.lane;
        color = parentInfo.color;
      } else {
        // 不是第一个 child（分支点）或 parent 不在范围内 → 新轨道
        lane = nextLane++;
        color = COLORS[nextColor % COLORS.length];
        nextColor++;
      }
      // 记录该 parent 已消费一个 child
      childCount.set(firstParent, count + 1);
    }

    commitData.set(commit.hash, { lane, color });
    commit._lane = lane;
    commit._color = color;
  }

  // 计算最大轨道号
  const maxLane = Math.max(...commits.map(c => c._lane || 0), 0);
  commits._maxLane = maxLane;

  return commits;
}

/**
 * 生成 SVG 连线路径
 * 连接提交点到其父提交点
 */
function buildPaths(commits) {
  const paths = [];
  const hashToRow = new Map();
  commits.forEach((c, i) => hashToRow.set(c.hash, i));

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    for (let p = 0; p < commit.parents.length; p++) {
      const parentHash = commit.parents[p];
      const parentRow = hashToRow.get(parentHash);
      // 父提交可能不在当前视图内（超过 max-count）
      if (parentRow === undefined) continue;

      const parentLane = commits[parentRow]._lane;
      const myLane = commit._lane;
      const y1 = i * ROW_HEIGHT + ROW_HEIGHT / 2;
      const y2 = parentRow * ROW_HEIGHT + ROW_HEIGHT / 2;
      const x1 = myLane * LANE_WIDTH + LANE_WIDTH / 2;
      const x2 = parentLane * LANE_WIDTH + LANE_WIDTH / 2;

      const color = commit._color;
      const isMergeParent = p > 0; // 第二个及以后的 parent 是合并进来的

      if (myLane === parentLane) {
        // 同一轨道：竖直线
        paths.push({
          d: `M ${x1} ${y1} L ${x1} ${y2}`,
          color,
          key: `${commit.hash}-${parentHash}-${p}`
        });
      } else {
        // 不同轨道：水平 + 垂直
        const midY = y1 + (y2 - y1) * 0.5;
        // 使用贝塞尔曲线，看起来更自然
        paths.push({
          d: `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`,
          color: isMergeParent ? commits[parentRow]._color : color,
          key: `${commit.hash}-${parentHash}-${p}`
        });
      }
    }
  }
  return paths;
}

/**
 * 单个提交节点（memo 优化：仅在 commit 数据变化或选中状态变化时重绘）
 */
const CommitNode = memo(function CommitNode({
  commit,
  index,
  laneWidth,
  rowHeight,
  dotRadius,
  refs,
  isSelected,
  isHead,
  onCommitClick,
  measureTextFn,
}) {
  const cx = commit._lane * laneWidth + laneWidth / 2;
  const cy = index * rowHeight + rowHeight / 2;

  return (
    <g className="commit-node-group">
      {/* 可点击的透明区域 */}
      <circle
        cx={cx}
        cy={cy}
        r={10}
        fill="transparent"
        style={{ cursor: 'pointer' }}
        onClick={() => onCommitClick(commit)}
      />
      {/* 提交圆点 */}
      <circle
        cx={cx}
        cy={cy}
        r={isHead ? dotRadius + 2 : dotRadius}
        fill={commit._color}
        stroke={isSelected ? '#fff' : 'none'}
        strokeWidth={isSelected ? 2 : 0}
        style={{ cursor: 'pointer', transition: 'r 0.15s' }}
        onClick={() => onCommitClick(commit)}
      />
      {/* 标签 */}
      {refs && (
        <g>
          {refs.branches.map((b, bi) => (
            <rect
              key={`b-${bi}`}
              x={cx + dotRadius + 4}
              y={cy - 8 - bi * 16}
              rx={3}
              ry={3}
              width={measureTextFn(b) + 10}
              height={14}
              fill={commit._color}
              opacity={0.9}
            />
          ))}
          {refs.branches.map((b, bi) => (
            <text
              key={`bt-${bi}`}
              x={cx + dotRadius + 9}
              y={cy + 2 - bi * 16}
              fill="#fff"
              fontSize="10"
              fontFamily="monospace"
            >
              {b}
            </text>
          ))}
          {refs.tags.map((t, ti) => (
            <rect
              key={`t-${ti}`}
              x={cx + dotRadius + 4}
              y={cy - 8 - (refs.branches.length + ti) * 16}
              rx={3}
              ry={3}
              width={measureTextFn(t) + 10}
              height={14}
              fill="#f0c674"
              opacity={0.9}
            />
          ))}
          {refs.tags.map((t, ti) => (
            <text
              key={`tt-${ti}`}
              x={cx + dotRadius + 9}
              y={cy + 2 - (refs.branches.length + ti) * 16}
              fill="#333"
              fontSize="10"
              fontFamily="monospace"
            >
              {t}
            </text>
          ))}
        </g>
      )}
      {/* 提交信息 */}
      <text
        x={
          cx +
          dotRadius +
          4 +
          (refs
            ? Math.max(
                ...refs.branches.map((b) => measureTextFn(b) + 10),
                ...refs.tags.map((t) => measureTextFn(t) + 10),
                0,
              ) +
              8
            : 8)
        }
        y={cy + 4}
        fill={isSelected ? '#fff' : '#abb2bf'}
        fontSize="12"
        fontFamily="monospace"
        style={{ cursor: 'pointer' }}
        onClick={() => onCommitClick(commit)}
      >
        <tspan fill="#5c6370">{commit.shortHash}</tspan>
        <tspan fill="#abb2bf" dx="8">{commit.subject}</tspan>
      </text>
    </g>
  );
});

/**
 * 提交图组件 — SVG 核心可视化
 */
const CommitGraph = memo(function CommitGraph({ commits, branches, tags, selectedCommit, onCommitClick, loadingMore, onLoadMore }) {
  // 分配轨道
  const processed = useMemo(() => {
    if (!commits || commits.length === 0) return { commits: [], paths: [], maxLane: 0, refMap: new Map() };
    const c = assignLanes([...commits]);
    const p = buildPaths(c);
    const maxLane = c._maxLane || 0;

    // 构建 ref 映射：hash -> { branches: [], tags: [], isHead }
    const refMap = new Map();
    for (const b of branches || []) {
      if (!refMap.has(b.hash)) refMap.set(b.hash, { branches: [], tags: [], isHead: false });
      refMap.get(b.hash).branches.push(b.name);
      if (b.isHead) refMap.get(b.hash).isHead = true;
    }
    for (const t of tags || []) {
      if (!refMap.has(t.hash)) refMap.set(t.hash, { branches: [], tags: [], isHead: false });
      refMap.get(t.hash).tags.push(t.name);
    }

    return { commits: c, paths: p, maxLane, refMap };
  }, [commits, branches, tags]);

  if (processed.commits.length === 0) return null;

  const { commits: displayCommits, paths, maxLane, refMap } = processed;
  const svgWidth = (maxLane + 1) * LANE_WIDTH + 400;
  const svgHeight = displayCommits.length * ROW_HEIGHT + 20;

  return (
    <div className="commit-graph-container">
      {/* 大规模仓库性能提示 */}
      {displayCommits.length > LARGE_REPO_THRESHOLD && (
        <div className="graph-perf-notice">
          ⚡ 已加载 {displayCommits.length} 个提交，渲染可能需要一些时间。
          考虑使用「加载更多」分页浏览。
        </div>
      )}

      <svg
        width={svgWidth}
        height={svgHeight}
        className="commit-graph-svg"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ contain: 'layout style' }}
      >
        {/* 连线 */}
        {paths.map(p => (
          <path
            key={p.key}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}

        {/* 提交节点 — 使用 memo 组件避免选中切换时全部重绘 */}
        {displayCommits.map((commit, i) => (
          <CommitNode
            key={commit.hash}
            commit={commit}
            index={i}
            laneWidth={LANE_WIDTH}
            rowHeight={ROW_HEIGHT}
            dotRadius={DOT_RADIUS}
            refs={refMap.get(commit.hash)}
            isSelected={selectedCommit?.hash === commit.hash}
            isHead={refMap.get(commit.hash)?.isHead}
            onCommitClick={onCommitClick}
            measureTextFn={measureText}
          />
        ))}
      </svg>
      {onLoadMore && (
        <div className="load-more-area">
          <button
            className="load-more-btn"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? '⏳ 加载中...' : '📜 加载更多提交'}
          </button>
        </div>
      )}
    </div>
  );
});

export default CommitGraph;
