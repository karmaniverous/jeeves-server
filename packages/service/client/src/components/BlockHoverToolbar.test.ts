import { describe, expect, it, vi } from 'vitest';

import { mountComponent } from '@/test/reactHarness';

import { BlockHoverToolbar } from './BlockHoverToolbar';

/** The first element matching `selector` in some HTML. */
function element(markup: string, selector: string): Element {
  const host = document.createElement('div');
  host.innerHTML = markup;
  return host.querySelector(selector)!;
}

const TABLE =
  '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>';

/** Mount the toolbar on `hoveredEl`; returns its button titles and handlers. */
async function toolbar(hoveredEl: Element) {
  const handlers = {
    onEdit: vi.fn(),
    onCopy: vi.fn(),
    onInsert: vi.fn(),
    onDelete: vi.fn(),
  };
  const view = await mountComponent(BlockHoverToolbar, {
    hoveredEl,
    hoverRect: { top: 40, left: 10, width: 100, height: 30 },
    controlsRef: { current: null },
    ...handlers,
  });
  const buttons = Array.from(view.container.querySelectorAll('button'));
  return {
    view,
    handlers,
    titles: buttons.map((b) => b.title),
    click: (title: string) => buttons.find((b) => b.title === title)!.click(),
  };
}

describe('BlockHoverToolbar', () => {
  it('offers every control on a block and wires each to its handler', async () => {
    const t = await toolbar(element('<p>x</p>', 'p'));
    expect(t.titles).toEqual([
      'Edit',
      'Copy',
      'Insert above',
      'Insert below',
      'Delete',
    ]);
    t.click('Edit');
    t.click('Copy');
    t.click('Insert above');
    t.click('Insert below');
    t.click('Delete');
    expect(t.handlers.onEdit).toHaveBeenCalledOnce();
    expect(t.handlers.onCopy).toHaveBeenCalledOnce();
    expect(t.handlers.onInsert.mock.calls).toEqual([['before'], ['after']]);
    expect(t.handlers.onDelete).toHaveBeenCalledOnce();
    // Positioned above the block, leaving room for the buttons.
    const overlay = t.view.container.firstElementChild as HTMLElement;
    expect([overlay.style.top, overlay.style.height]).toEqual(['20px', '50px']);
    await t.view.unmount();
  });

  it.each([
    ['a cell: edit and copy only', 'td', ['Edit', 'Copy']],
    [
      'the header row: no insert below or delete',
      'thead tr',
      ['Edit', 'Copy', 'Insert above'],
    ],
    [
      'a body row: everything',
      'tbody tr',
      ['Edit', 'Copy', 'Insert above', 'Insert below', 'Delete'],
    ],
  ])('on %s', async (_label, selector, titles) => {
    const t = await toolbar(element(TABLE, selector));
    expect(t.titles).toEqual(titles);
    await t.view.unmount();
  });
});
