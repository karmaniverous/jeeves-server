import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkNodeVersion,
  meetsNodeFloor,
  MIN_NODE_VERSION,
} from './checkNodeVersion.js';

describe('meetsNodeFloor', () => {
  it.each([
    ['24.22.2', true],
    ['24.22.3', true],
    ['24.23.0', true],
    ['25.0.0', true],
    ['26.1.0', true],
    ['24.22.1', false],
    ['24.21.9', false],
    ['24.18.0', false],
    ['23.99.99', false],
    ['22.22.2', false],
    ['24.22.2-rc.1', true],
    ['24.22', false],
    ['25', true],
    ['not-a-version', false],
  ])('%s against the floor -> %s', (version, expected) => {
    expect(meetsNodeFloor(version)).toBe(expected);
  });

  it('compares against a given floor', () => {
    expect(meetsNodeFloor('22.0.0', '22.0.0')).toBe(true);
    expect(meetsNodeFloor('21.9.9', '22.0.0')).toBe(false);
  });
});

describe('checkNodeVersion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const spies = () => ({
    exit: vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never),
    error: vi.spyOn(console, 'error').mockImplementation(() => undefined),
  });

  it('exits with code 1 and names both versions below the floor', () => {
    const { exit, error } = spies();
    checkNodeVersion('24.18.0');
    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalledWith(
      'Error: jeeves-server requires Node.js >= 24.22.2. Current: 24.18.0',
    );
  });

  it('does nothing at or above the floor', () => {
    const { exit, error } = spies();
    checkNodeVersion(MIN_NODE_VERSION);
    checkNodeVersion();
    expect(exit).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});

describe('engines.node', () => {
  it.each([
    '../../../../package.json',
    '../../../core/package.json',
    '../../../openclaw/package.json',
    '../../package.json',
  ])('%s requires the same floor as the start-up check', (path) => {
    const pkg = JSON.parse(
      readFileSync(new URL(path, import.meta.url), 'utf8'),
    ) as { engines: { node: string } };
    expect(pkg.engines.node).toBe(`>=${MIN_NODE_VERSION}`);
  });
});
