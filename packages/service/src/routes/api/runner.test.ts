import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@karmaniverous/jeeves', () => ({
  getServiceUrl: vi.fn(),
}));

const { getServiceUrl } = await import('@karmaniverous/jeeves');
const mockedGetServiceUrl = vi.mocked(getServiceUrl);

describe('runner URL resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves runner URL via core getServiceUrl', () => {
    mockedGetServiceUrl.mockReturnValue('http://127.0.0.1:1937');
    const url = getServiceUrl('runner');
    expect(url).toBe('http://127.0.0.1:1937');
    expect(mockedGetServiceUrl).toHaveBeenCalledWith('runner');
  });

  it('uses the URL from core, not a hardcoded default', () => {
    mockedGetServiceUrl.mockReturnValue('http://10.0.0.5:9999');
    const url = getServiceUrl('runner');
    expect(url).toBe('http://10.0.0.5:9999');
  });

  it('constructs proxy paths correctly from the resolved URL', () => {
    mockedGetServiceUrl.mockReturnValue('http://127.0.0.1:1937');
    const base = getServiceUrl('runner');
    const jobId = 'my-job';
    expect(`${base}/jobs/${encodeURIComponent(jobId)}`).toBe(
      'http://127.0.0.1:1937/jobs/my-job',
    );
    expect(`${base}/jobs/${encodeURIComponent(jobId)}/runs?limit=20`).toBe(
      'http://127.0.0.1:1937/jobs/my-job/runs?limit=20',
    );
  });
});
