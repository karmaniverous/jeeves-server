import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateServerMenu } from './promptInjection.js';

describe('generateServerMenu', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a compact unavailable message when server is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const menu = await generateServerMenu('http://localhost:1934');
    expect(menu).toContain('status unavailable');
    expect(menu).not.toContain('ACTION REQUIRED');
  });

  it('renders version and port from health-nested status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => ({ version: '3.0.0', health: { port: 1934 } }),
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
        health: {
          exports: {
            documents: ['pdf', 'docx'],
            directories: ['zip'],
            diagrams: ['svg', 'png'],
            chromeAvailable: true,
          },
        },
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
        health: {
          exports: {
            documents: ['docx'],
            chromeAvailable: false,
          },
        },
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
        health: {
          events: [{ name: 'webhook', pattern: '/event/*' }],
          auth: { insiderCount: 3 },
        },
      }),
    } as unknown as Response);
    const menu = await generateServerMenu('http://localhost:1934');
    expect(menu).toContain('webhook');
    expect(menu).toContain('/event/*');
    expect(menu).toContain('3 insider(s)');
  });

  it('mentions automatic URL rewriting in sharing guidance', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => ({ version: '3.0.0', health: {} }),
    } as unknown as Response);
    const menu = await generateServerMenu('http://localhost:1934');
    expect(menu).toContain('automatically rewritten');
    expect(menu).toContain('publicUrl');
    expect(menu).not.toContain('always rewrite');
  });

  it('does not render connected services (plugin isolation #128)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => ({
        version: '3.0.0',
        health: {
          services: {
            watcher: { url: 'http://localhost:1936', reachable: true },
            runner: { url: 'http://localhost:1937', reachable: false },
          },
        },
      }),
    } as unknown as Response);
    const menu = await generateServerMenu('http://localhost:1934');
    expect(menu).not.toContain('Connected Services');
    expect(menu).not.toContain('watcher');
  });
});
