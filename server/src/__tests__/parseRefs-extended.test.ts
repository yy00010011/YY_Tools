import { parseRefs } from '../gitService';

describe('parseRefs — 扩展边界测试', () => {
  describe('空值和异常输入', () => {
    it('处理只含空格的内容', () => {
      expect(parseRefs('   ')).toEqual({ branches: [], tags: [], isHead: false });
    });

    it('处理空括号', () => {
      expect(parseRefs('()')).toEqual({ branches: [], tags: [], isHead: false });
    });

    it('处理只含逗号的括号', () => {
      const result = parseRefs('( , , )');
      expect(result.branches.length).toBeGreaterThanOrEqual(0);
      expect(result.tags).toEqual([]);
      expect(result.isHead).toBe(false);
    });
  });

  describe('HEAD 引用', () => {
    it('HEAD 指向带斜杠的分支名', () => {
      const result = parseRefs('(HEAD -> feature/login)');
      expect(result.branches).toEqual(['feature/login']);
      expect(result.isHead).toBe(true);
    });

    it('HEAD 指向含特殊字符的分支名', () => {
      const result = parseRefs('(HEAD -> fix/issue-42_v2)');
      expect(result.branches).toEqual(['fix/issue-42_v2']);
      expect(result.isHead).toBe(true);
    });

    it('HEAD 指向 + 多个远程分支 + 标签', () => {
      const result = parseRefs('(HEAD -> develop, origin/develop, origin/main, tag: v2.0.0)');
      expect(result.branches).toEqual(['develop', 'origin/develop', 'origin/main']);
      expect(result.tags).toEqual(['v2.0.0']);
      expect(result.isHead).toBe(true);
    });
  });

  describe('标签解析', () => {
    it('解析多个标签且无分支', () => {
      const result = parseRefs('(tag: v1.0, tag: v1.1, tag: v2.0)');
      expect(result.tags).toEqual(['v1.0', 'v1.1', 'v2.0']);
      expect(result.branches).toEqual([]);
    });

    it('解析带命名空间的标签', () => {
      const result = parseRefs('(tag: release/v3.0-beta.1)');
      expect(result.tags).toEqual(['release/v3.0-beta.1']);
    });

    it('解析标签中的 tag: 不在开头', () => {
      const result = parseRefs('(HEAD -> main, tag: v1.0)');
      expect(result.isHead).toBe(true);
      expect(result.tags).toEqual(['v1.0']);
      expect(result.branches).toEqual(['main']);
    });
  });

  describe('分离 HEAD 状态', () => {
    it('分离 HEAD（无分支名）', () => {
      const result = parseRefs('(HEAD, tag: snapshot)');
      expect(result.branches).toEqual(['HEAD']);
      expect(result.tags).toEqual(['snapshot']);
      expect(result.isHead).toBe(false); // HEAD 本身不算 isHead
    });

    it('分离 HEAD 在某个提交上', () => {
      const result = parseRefs('(HEAD, origin/main, main)');
      // HEAD 出现在 parts 中但无 "->" 箭头
      expect(result.branches).toContain('HEAD');
      expect(result.isHead).toBe(false);
    });
  });

  describe('无括号输入', () => {
    it('解析纯分支名', () => {
      const result = parseRefs('master');
      expect(result.branches).toEqual(['master']);
      expect(result.tags).toEqual([]);
      expect(result.isHead).toBe(false);
    });

    it('解析 gh-pages 分支', () => {
      const result = parseRefs('gh-pages');
      expect(result.branches).toEqual(['gh-pages']);
    });
  });

  describe('真实场景模拟', () => {
    it('git log 常见输出：HEAD + 远程跟踪 + 标签', () => {
      const result = parseRefs('(HEAD -> main, origin/main, origin/HEAD, tag: v1.0.0)');
      expect(result.branches).toEqual(['main', 'origin/main', 'origin/HEAD']);
      expect(result.tags).toEqual(['v1.0.0']);
      expect(result.isHead).toBe(true);
    });

    it('远程分支在 tag 之前', () => {
      const result = parseRefs('(origin/feature, tag: feature-done)');
      expect(result.branches).toEqual(['origin/feature']);
      expect(result.tags).toEqual(['feature-done']);
    });
  });
});
