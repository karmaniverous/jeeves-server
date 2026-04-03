import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@karmaniverous/jeeves', () => ({
  getServiceUrl: vi.fn(),
}));

const { getServiceUrl } = await import('@karmaniverous/jeeves');
const mockedGetServiceUrl = vi.mocked(getServiceUrl);

describe('search watcher URL resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves watcher URL via core getServiceUrl', () => {
    mockedGetServiceUrl.mockReturnValue('http://127.0.0.1:1936');
    const url = getServiceUrl('watcher');
    expect(url).toBe('http://127.0.0.1:1936');
    expect(mockedGetServiceUrl).toHaveBeenCalledWith('watcher');
  });

  it('uses core-resolved URL, not a hardcoded default', () => {
    mockedGetServiceUrl.mockReturnValue('http://10.0.0.5:8888');
    const url = getServiceUrl('watcher');
    expect(url).toBe('http://10.0.0.5:8888');
  });

  it('constructs search endpoint from resolved watcher URL', () => {
    mockedGetServiceUrl.mockReturnValue('http://127.0.0.1:1936');
    const watcherUrl = getServiceUrl('watcher');
    expect(`${watcherUrl}/search`).toBe('http://127.0.0.1:1936/search');
    expect(`${watcherUrl}/search/facets`).toBe(
      'http://127.0.0.1:1936/search/facets',
    );
  });
});
