/**
 * Tests for browse path titles (#262): a drive root's label, a directory's
 * name, a Markdown document's front-matter title (native and watcher), other
 * files' names, and the 1.5 s budget when the watcher is slow or fails.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RootEntry } from '../util/platform.js';
import type { WatcherRenderOutcome } from './watcherRender.js';

const renderViaWatcher = vi.hoisted(() =>
  vi.fn<(p: string) => Promise<WatcherRenderOutcome>>(),
);
vi.mock('./watcherRender.js', () => ({ renderViaWatcher }));
vi.mock('../config/index.js', () => ({
  getConfig: () => ({ branding: { name: 'Brand' } }),
}));

const { pathTitle, TITLE_BUDGET_MS } = await import('./pathTitle.js');

const watcherMd = (content: string): WatcherRenderOutcome => ({
  status: 'rendered',
  data: { renderAs: 'md', content, rules: ['brief'], metadata: {} },
});

let dir = '';
let roots: RootEntry[] = [];
function write(name: string, content: string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeeves-title-'));
  roots = [{ id: 'r', label: 'Root Drive', fsPath: dir + path.sep }];
  renderViaWatcher.mockReset().mockResolvedValue({ status: 'none' });
});

afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('pathTitle', () => {
  it('is the label of a drive root', async () => {
    expect(await pathTitle(path.resolve(dir), roots)).toBe('Root Drive');
  });

  it('is the name of a directory', async () => {
    fs.mkdirSync(path.join(dir, 'Reports'));
    expect(await pathTitle(path.join(dir, 'Reports'), roots)).toBe('Reports');
  });

  it("is a native document's front-matter title", async () => {
    const file = write('a.md', '---\ntitle: Daily Brief\n---\n# H\n');
    expect(await pathTitle(file, roots)).toBe('Daily Brief');
  });

  it("is a document's file name without a front-matter title", async () => {
    const file = write('notes.md', '# H\n');
    expect(await pathTitle(file, roots)).toBe('notes.md');
  });

  it("is a watcher-rendered document's title", async () => {
    renderViaWatcher.mockResolvedValue(watcherMd('---\ntitle: W\n---\nx'));
    const file = write('brief.json', '{"a":1}');
    expect(await pathTitle(file, roots)).toBe('W');
  });

  it('is the file name of a file that is no document', async () => {
    const file = write('data.json', '{"a":1}');
    expect(await pathTitle(file, roots)).toBe('data.json');
  });

  it('falls back to the file name when the watcher fails', async () => {
    renderViaWatcher.mockRejectedValue(new Error('boom'));
    const file = write('brief.json', '{"a":1}');
    expect(await pathTitle(file, roots)).toBe('brief.json');
  });

  it('falls back to the file name within the budget when the watcher is slow', async () => {
    vi.useFakeTimers();
    renderViaWatcher.mockReturnValue(new Promise(() => undefined));
    const file = write('brief.json', '{"a":1}');
    let title: string | undefined;
    void pathTitle(file, roots).then((t) => (title = t));
    await vi.advanceTimersByTimeAsync(TITLE_BUDGET_MS - 1);
    expect(title).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(title).toBe('brief.json');
    expect(TITLE_BUDGET_MS).toBe(1500);
  });
});
