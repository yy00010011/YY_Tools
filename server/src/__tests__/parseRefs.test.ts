import { parseRefs } from '../gitService';

describe('parseRefs', () => {
  it('返回空对象当输入为空字符串', () => {
    expect(parseRefs('')).toEqual({ branches: [], tags: [], isHead: false });
  });

  it('返回空对象当输入为 null/undefined', () => {
    expect(parseRefs(null as any)).toEqual({ branches: [], tags: [], isHead: false });
    expect(parseRefs(undefined as any)).toEqual({ branches: [], tags: [], isHead: false });
  });

  it('解析 HEAD 指向', () => {
    const result = parseRefs('(HEAD -> main)');
    expect(result.branches).toEqual(['main']);
    expect(result.tags).toEqual([]);
    expect(result.isHead).toBe(true);
  });

  it('解析单分支（非 HEAD）', () => {
    const result = parseRefs('(origin/main)');
    expect(result.branches).toEqual(['origin/main']);
    expect(result.tags).toEqual([]);
    expect(result.isHead).toBe(false);
  });

  it('解析分支 + 标签', () => {
    const result = parseRefs('(HEAD -> main, tag: v1.0)');
    expect(result.branches).toEqual(['main']);
    expect(result.tags).toEqual(['v1.0']);
    expect(result.isHead).toBe(true);
  });

  it('解析多分支和多标签', () => {
    const result = parseRefs('(HEAD -> main, origin/main, tag: v1.0, tag: v0.9)');
    expect(result.branches).toEqual(['main', 'origin/main']);
    expect(result.tags).toEqual(['v1.0', 'v0.9']);
    expect(result.isHead).toBe(true);
  });

  it('解析远程分支（非 HEAD）', () => {
    const result = parseRefs('(origin/feature)');
    expect(result.branches).toEqual(['origin/feature']);
    expect(result.isHead).toBe(false);
  });

  it('解析带标签名的分支（含斜杠）', () => {
    const result = parseRefs('(tag: release/1.0)');
    expect(result.tags).toEqual(['release/1.0']);
    expect(result.branches).toEqual([]);
  });

  it('解析无括号的纯字符串', () => {
    const result = parseRefs('main');
    expect(result.branches).toEqual(['main']);
    expect(result.isHead).toBe(false);
  });

  it('处理多余的括号 — 只剥最外层', () => {
    // 模拟异常输入：(HEAD -> fix(bug))
    const result = parseRefs('(HEAD -> fix(bug))');
    expect(result.branches).toEqual(['fix(bug)']);
    expect(result.isHead).toBe(true);
  });
});
