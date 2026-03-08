import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateServerMenu } from './promptInjection.js';

describe('generateServerMenu', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ACTION REQUIRED when server is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const menu = await generateServerMenu('http://localhost:1934');
    expect(menu).toContain('ACTION REQUIRED');
    expect(menu).toContain('jeeves-server is unreachable');
  });

  it('renders version and port from status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => ({ version: '3.0.0', port: 1934 }),
    } as unknown as Response);
    const menu = await generateServerMenu('http://localhost:1934');
    expect(menu).toContain('v3.0.0');
    expect(menu).toContain('1934');
  });

  it('renders export formats', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => ({
        version: '3.0.0',
        port: 1934,
        exportFormats: ['pdf', 'docx'],
        chrome: true,
      }),
    } as unknown as Response);
    const menu = await generateServerMenu('http://localhost:1934');
    expect(menu).toContain('pdf, docx');
    expect(menu).not.toContain('Chrome not detected');
  });

  it('warns when chrome is not available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => ({
        version: '3.0.0',
        port: 1934,
        exportFormats: ['docx'],
        chrome: false,
      }),
    } as unknown as Response);
    const menu = await generateServerMenu('http://localhost:1934');
    expect(menu).toContain('Chrome not detected');
  });

  it('renders events and insider count', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => ({
        version: '3.0.0',
        port: 1934,
        events: [{ name: 'webhook', pattern: '/event/*' }],
        insiderCount: 3,
      }),
    } as unknown as Response);
    const menu = await generateServerMenu('http://localhost:1934');
    expect(menu).toContain('webhook');
    expect(menu).toContain('/event/*');
    expect(menu).toContain('3 insider(s)');
  });

  it('renders connected services with reachability icons', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => ({
        version: '3.0.0',
        port: 1934,
        services: {
          watcher: { url: 'http://localhost:1936', reachable: true },
          runner: { url: 'http://localhost:1937', reachable: false },
        },
      }),
    } as unknown as Response);
    const menu = await generateServerMenu('http://localhost:1934');
    expect(menu).toContain('\u2705');
    expect(menu).toContain('\u274c');
    expect(menu).toContain('watcher');
  });
});
