import { describe, expect, it } from 'vitest';

import { toggleCheckbox } from './fileMutationActions.js';

// ─── Pure function tests (ported from toggleCheckbox.test.ts) ───

describe('toggleCheckbox (pure function)', () => {
  it('checks an unchecked checkbox', () => {
    const result = toggleCheckbox('- [ ] first\n- [ ] second', 0, true);
    expect(result).not.toBeNull();
    expect(result!.result).toBe('- [x] first\n- [ ] second');
    expect(result!.total).toBe(2);
  });

  it('unchecks a checked checkbox', () => {
    const result = toggleCheckbox('- [x] first\n- [x] second', 1, false);
    expect(result).not.toBeNull();
    expect(result!.result).toBe('- [x] first\n- [ ] second');
  });

  it('returns null for out-of-range index', () => {
    expect(toggleCheckbox('- [ ] only', 5, true)).toBeNull();
  });

  it('returns null for negative index', () => {
    expect(toggleCheckbox('- [ ] only', -1, true)).toBeNull();
  });

  it('preserves surrounding content unchanged', () => {
    const content = '# Title\n\nSome text\n\n- [ ] task\n\nMore text\n';
    const result = toggleCheckbox(content, 0, true);
    expect(result).not.toBeNull();
    expect(result!.result).toBe(
      '# Title\n\nSome text\n\n- [x] task\n\nMore text\n',
    );
  });

  it('flips only the targeted checkbox among many', () => {
    const content = '- [ ] a\n- [ ] b\n- [x] c\n- [ ] d\n';
    const result = toggleCheckbox(content, 2, false);
    expect(result).not.toBeNull();
    expect(result!.result).toBe('- [ ] a\n- [ ] b\n- [ ] c\n- [ ] d\n');
    expect(result!.total).toBe(4);
  });

  it('handles uppercase [X]', () => {
    const result = toggleCheckbox('- [X] done', 0, false);
    expect(result).not.toBeNull();
    expect(result!.result).toBe('- [ ] done');
  });

  it('does not count [ ] inside a link as a checkbox', () => {
    const content = 'See [this link][ ] for info\n- [ ] real task\n';
    const result = toggleCheckbox(content, 0, true);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(1);
    expect(result!.result).toBe(
      'See [this link][ ] for info\n- [x] real task\n',
    );
  });

  it('does not count [ ] in plain text as a checkbox', () => {
    const content = 'The array[x] syntax\n- [ ] actual task\n';
    const result = toggleCheckbox(content, 0, true);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(1);
    expect(result!.result).toContain('- [x] actual task');
  });

  it('matches checkboxes with * and + list markers', () => {
    const content = '* [ ] star item\n+ [ ] plus item\n';
    const result = toggleCheckbox(content, 0, true);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(2);
    expect(result!.result).toBe('* [x] star item\n+ [ ] plus item\n');
  });

  it('matches checkboxes with ordered list markers', () => {
    const content = '1. [ ] first\n2. [x] second\n';
    const result = toggleCheckbox(content, 1, false);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(2);
    expect(result!.result).toBe('1. [ ] first\n2. [ ] second\n');
  });

  it('matches indented checkboxes', () => {
    const content = '  - [ ] indented task\n';
    const result = toggleCheckbox(content, 0, true);
    expect(result).not.toBeNull();
    expect(result!.result).toBe('  - [x] indented task\n');
  });
});
