import { describe, expect, it } from 'vitest';

import {
  computeOverlayRect,
  copyTextOf,
  editFor,
  extractSourceLines,
  findHoverTarget,
  insertFor,
  isHeaderRow,
  sourceRangeOf,
} from './blockHoverDom';

/** A detached element from HTML. */
function html(markup: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = markup;
  return host;
}

/** Give `el` a fixed bounding rectangle. */
function rectOf(el: Element, top: number, bottom: number, left = 0): void {
  el.getBoundingClientRect = () =>
    ({ top, bottom, left, width: 100, height: bottom - top }) as DOMRect;
}

const TABLE = `<table data-source-start="3" data-source-end="6">
  <thead><tr><th>A</th><th>B</th></tr></thead>
  <tbody><tr><td>1</td><td> two </td></tr><tr><td>3</td><td></td></tr></tbody>
</table>`;

const SOURCE = 'l1\nl2\r\n| A | B |\n|---|---|\n| 1 | two |\n| 3 | |';

describe('blockHoverDom', () => {
  it('extracts source lines 1-based and inclusive across line endings', () => {
    expect(extractSourceLines(SOURCE, 2, 3)).toBe('l2\n| A | B |');
  });

  it('targets a cell of a mapped table, else the innermost mapped block', () => {
    const host = html(
      `${TABLE}<ul data-source-start="8" data-source-end="9"><li data-source-start="8" data-source-end="8"><em>x</em></li></ul><p>plain</p>`,
    );
    const td = host.querySelector('td')!;
    expect(findHoverTarget(td, 0)).toBe(td);
    const ul = host.querySelector('ul')!;
    rectOf(ul, 0, 100);
    const li = host.querySelector('li')!;
    expect(findHoverTarget(host.querySelector('em')!, 50)).toBe(li);
    expect(findHoverTarget(host.querySelector('p')!, 50)).toBeNull();
  });

  it('prefers the parent block within 8px of its top or bottom edge', () => {
    const host = html(
      '<ul data-source-start="1" data-source-end="2"><li data-source-start="1" data-source-end="1">x</li></ul>',
    );
    const ul = host.querySelector('ul')!;
    const li = host.querySelector('li')!;
    rectOf(ul, 100, 200);
    expect(findHoverTarget(li, 108)).toBe(ul);
    expect(findHoverTarget(li, 192)).toBe(ul);
    expect(findHoverTarget(li, 109)).toBe(li);
    expect(findHoverTarget(li, 191)).toBe(li);
  });

  it('computes the padded overlay rectangle relative to the scrolled container', () => {
    const container = html('<p>x</p>');
    const p = container.querySelector('p')!;
    rectOf(container, 10, 1000, 5);
    rectOf(p, 50, 70, 25);
    container.scrollTop = 30;
    expect(computeOverlayRect(p, container)).toEqual({
      top: 50 - 10 + container.scrollTop - 6,
      left: 25 - 5 - 6,
      width: 112,
      height: 32,
    });
  });

  it("reads an element's source range, a cell's from its table, zero when unmapped", () => {
    const host = html(
      `${TABLE}<p data-source-start="8" data-source-end="9">p</p><div>u</div>`,
    );
    expect(sourceRangeOf(host.querySelector('td')!)).toEqual({
      startLine: 3,
      endLine: 6,
    });
    expect(sourceRangeOf(host.querySelector('p')!)).toEqual({
      startLine: 8,
      endLine: 9,
    });
    expect(sourceRangeOf(host.querySelector('div')!)).toEqual({
      startLine: 0,
      endLine: 0,
    });
  });

  it('knows the header row', () => {
    const host = html(TABLE);
    const [head, body] = Array.from(host.querySelectorAll('tr'));
    expect(isHeaderRow(head!)).toBe(true);
    expect(isHeaderRow(body!)).toBe(false);
  });

  it('edits a cell at its row line and column (header at the table start, body rows after the delimiter)', () => {
    const host = html(TABLE);
    const cells = host.querySelectorAll('th, td');
    expect(editFor(cells[1]!, SOURCE)).toEqual({
      label: 'cell',
      mode: { kind: 'edit-cell', line: 3, col: 1, content: 'B' },
    });
    expect(editFor(cells[3]!, SOURCE)?.mode).toEqual({
      kind: 'edit-cell',
      line: 5,
      col: 1,
      content: 'two',
    });
    expect(editFor(cells[4]!, SOURCE)?.mode).toMatchObject({ line: 6, col: 0 });
  });

  it('edits a block over its source lines; nothing for an unmapped element', () => {
    const host = html(
      '<p data-source-start="1" data-source-end="2">p</p><div>u</div><table><tr><td>x</td></tr></table>',
    );
    expect(editFor(host.querySelector('p')!, SOURCE)?.mode).toMatchObject({
      kind: 'edit-block',
      startLine: 1,
      endLine: 2,
      content: 'l1\nl2',
    });
    expect(editFor(host.querySelector('div')!, SOURCE)).toBeNull();
    expect(editFor(host.querySelector('td')!, SOURCE)).toBeNull();
  });

  it('inserts before the start or after the end; a table row prefilled to the table width', () => {
    const host = html(
      `${TABLE}<p data-source-start="8" data-source-end="9">p</p>`,
    );
    const p = host.querySelector('p')!;
    expect(insertFor(p, 'before')?.mode).toMatchObject({
      kind: 'insert-block',
      atLine: 8,
      position: 'before',
      content: undefined,
    });
    expect(insertFor(p, 'after')?.mode).toMatchObject({ atLine: 9 });
    const row = host.querySelectorAll('tr')[1]!;
    row.setAttribute('data-source-start', '5');
    row.setAttribute('data-source-end', '5');
    expect(insertFor(row, 'after')?.mode).toMatchObject({
      atLine: 5,
      content: '|   |   |',
      context: 'table-row',
    });
    expect(
      insertFor(
        host.querySelector('td')!.parentElement!.parentElement!,
        'after',
      ),
    ).toBeNull();
  });

  it("copies a cell's text or a block's source; nothing when empty or unmapped", () => {
    const host = html(
      `${TABLE}<p data-source-start="1" data-source-end="1">p</p><div>u</div>`,
    );
    const cells = host.querySelectorAll('td');
    expect(copyTextOf(cells[1]!, SOURCE)).toBe('two');
    expect(copyTextOf(cells[3]!, SOURCE)).toBeNull();
    expect(copyTextOf(host.querySelector('p')!, SOURCE)).toBe('l1');
    expect(copyTextOf(host.querySelector('div')!, SOURCE)).toBeNull();
  });
});
