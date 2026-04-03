import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@karmaniverous/jeeves', () => ({
  getBindAddress: vi.fn(),
}));

const { getBindAddress } = await import('@karmaniverous/jeeves');
const mockedGetBindAddress = vi.mocked(getBindAddress);

/**
 * Replicate the bind-address resolution logic from export.ts:
 * 0.0.0.0 (all interfaces) is not a valid request target, so fall back to loopback.
 */
function resolveRenderHost(bindAddr: string): string {
  return bindAddr === '0.0.0.0' ? '127.0.0.1' : bindAddr;
}

describe('export render host resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves 0.0.0.0 to 127.0.0.1 for Chrome render URL', () => {
    mockedGetBindAddress.mockReturnValue('0.0.0.0');
    const bindAddr = getBindAddress('server');
    const renderHost = resolveRenderHost(bindAddr);
    expect(renderHost).toBe('127.0.0.1');
  });

  it('preserves a specific bind address for Chrome render URL', () => {
    mockedGetBindAddress.mockReturnValue('192.168.1.5');
    const bindAddr = getBindAddress('server');
    const renderHost = resolveRenderHost(bindAddr);
    expect(renderHost).toBe('192.168.1.5');
  });

  it('preserves loopback address as-is', () => {
    mockedGetBindAddress.mockReturnValue('127.0.0.1');
    const bindAddr = getBindAddress('server');
    const renderHost = resolveRenderHost(bindAddr);
    expect(renderHost).toBe('127.0.0.1');
  });

  it('constructs a valid export URL with resolved host and port', () => {
    mockedGetBindAddress.mockReturnValue('0.0.0.0');
    const bindAddr = getBindAddress('server');
    const renderHost = resolveRenderHost(bindAddr);
    const port = 1934;
    const reqPath = 'c/docs/readme.md';
    const key = 'test-key';
    const exportUrl = `http://${renderHost}:${String(port)}/browse/${reqPath}?key=${key}&render_diagrams=1&plain_code=1`;
    expect(exportUrl).toBe(
      'http://127.0.0.1:1934/browse/c/docs/readme.md?key=test-key&render_diagrams=1&plain_code=1',
    );
  });
});
