/**
 * Tests for OpenClaw path resolution utilities.
 */

import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveConfigPath, resolveOpenClawHome } from './openclawPaths.js';

describe('resolveOpenClawHome', () => {
  afterEach(() => {
    delete process.env.OPENCLAW_CONFIG;
    delete process.env.OPENCLAW_HOME;
  });

  it('returns dirname of OPENCLAW_CONFIG when set', () => {
    process.env.OPENCLAW_CONFIG = '/custom/path/openclaw.json';
    expect(resolveOpenClawHome()).toBe(
      dirname(resolve('/custom/path/openclaw.json')),
    );
  });

  it('returns OPENCLAW_HOME when set (no OPENCLAW_CONFIG)', () => {
    process.env.OPENCLAW_HOME = '/custom/home';
    expect(resolveOpenClawHome()).toBe(resolve('/custom/home'));
  });

  it('prefers OPENCLAW_CONFIG over OPENCLAW_HOME', () => {
    process.env.OPENCLAW_CONFIG = '/config/path/openclaw.json';
    process.env.OPENCLAW_HOME = '/home/path';
    expect(resolveOpenClawHome()).toBe(
      dirname(resolve('/config/path/openclaw.json')),
    );
  });

  it('falls back to ~/.openclaw when no env vars set', () => {
    expect(resolveOpenClawHome()).toBe(join(homedir(), '.openclaw'));
  });
});

describe('resolveConfigPath', () => {
  afterEach(() => {
    delete process.env.OPENCLAW_CONFIG;
  });

  it('returns OPENCLAW_CONFIG when set', () => {
    process.env.OPENCLAW_CONFIG = '/custom/openclaw.json';
    expect(resolveConfigPath('/ignored')).toBe(
      resolve('/custom/openclaw.json'),
    );
  });

  it('returns home/openclaw.json when no env var', () => {
    expect(resolveConfigPath('/my/home')).toBe(
      join('/my/home', 'openclaw.json'),
    );
  });
});
