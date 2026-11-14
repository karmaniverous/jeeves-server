import { describe, expect, it, vi } from 'vitest';

import { headerMenuItems } from './headerMenuItems';

const base = { theme: 'dark' as const, onToggleTheme: vi.fn() };

describe('headerMenuItems', () => {
  it('lists every control in header order with its breakpoint for an insider', () => {
    const menu = vi.fn();
    const items = headerMenuItems({
      ...base,
      isInsider: true,
      onRotateKey: vi.fn(),
      downloadMenuItem: menu,
      linkMenuItem: menu,
    });
    expect(items.map((i) => i.breakpoint)).toEqual([
      'bp-400',
      'bp-480',
      'sm',
      'md',
      'md',
      'md',
      'md',
    ]);
    expect(items.slice(0, 2).map((i) => [i.node, i.hasNestedDropdown])).toEqual(
      [
        [menu, true],
        [menu, true],
      ],
    );
  });

  it('leaves out link, download, key and runner items when absent or not an insider', () => {
    expect(
      headerMenuItems({ ...base, isInsider: false }).map((i) => i.breakpoint),
    ).toEqual(['md', 'md', 'md']);
  });
});
