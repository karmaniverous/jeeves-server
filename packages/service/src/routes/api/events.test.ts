import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the eventLog service
vi.mock('../../services/eventLog.js', () => ({
  getRecentEvents: vi.fn(),
}));

const { getRecentEvents } = await import('../../services/eventLog.js');
const mockedGetRecentEvents = vi.mocked(getRecentEvents);
const { DEFAULT_EVENTS_LIMIT, MAX_EVENTS_LIMIT } = await import('./events.js');

// Capture the route registration
const registeredRoutes: Record<
  string,
  {
    method: string;
    path: string;
    handler: (request: {
      query: Record<string, string>;
      accessMode?: string;
      insiderScopes?: unknown;
    }) => Promise<unknown>;
  }
> = {};

const mockFastify = {
  get: (
    path: string,
    handler: (request: {
      query: Record<string, string>;
      accessMode?: string;
      insiderScopes?: unknown;
    }) => Promise<unknown>,
  ) => {
    registeredRoutes[path] = { method: 'GET', path, handler };
  },
};

describe('eventsRoutes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { eventsRoutes } = await import('./events.js');
    await eventsRoutes(mockFastify as never, {});
  });

  it('registers route at /api/events', () => {
    expect(registeredRoutes['/api/events']).toBeDefined();
    expect(registeredRoutes['/events']).toBeUndefined();
  });

  it('returns recent events with default limit', async () => {
    const mockEvents = [
      { ts: '2026-01-01T00:00:00Z', event: 'test', matched: true },
    ];
    mockedGetRecentEvents.mockReturnValue(mockEvents);

    const result = await registeredRoutes['/api/events'].handler({
      accessMode: 'insider',
      insiderScopes: null,
      query: {},
    });

    expect(mockedGetRecentEvents).toHaveBeenCalledWith(DEFAULT_EVENTS_LIMIT);
    expect(result).toEqual(mockEvents);
  });

  it('respects custom limit', async () => {
    mockedGetRecentEvents.mockReturnValue([] as never);

    await registeredRoutes['/api/events'].handler({
      accessMode: 'insider',
      insiderScopes: null,
      query: { limit: '50' },
    });

    expect(mockedGetRecentEvents).toHaveBeenCalledWith(50);
  });

  it('caps limit at the maximum', async () => {
    mockedGetRecentEvents.mockReturnValue([] as never);

    await registeredRoutes['/api/events'].handler({
      accessMode: 'insider',
      insiderScopes: null,
      query: { limit: '999' },
    });

    expect(mockedGetRecentEvents).toHaveBeenCalledWith(MAX_EVENTS_LIMIT);
  });

  it('treats zero as falsy and falls back to the default', async () => {
    mockedGetRecentEvents.mockReturnValue([] as never);

    await registeredRoutes['/api/events'].handler({
      accessMode: 'insider',
      insiderScopes: null,
      query: { limit: '0' },
    });

    expect(mockedGetRecentEvents).toHaveBeenCalledWith(DEFAULT_EVENTS_LIMIT);
  });

  it('falls back to the default for non-numeric limit', async () => {
    mockedGetRecentEvents.mockReturnValue([] as never);

    await registeredRoutes['/api/events'].handler({
      accessMode: 'insider',
      insiderScopes: null,
      query: { limit: 'abc' },
    });

    expect(mockedGetRecentEvents).toHaveBeenCalledWith(DEFAULT_EVENTS_LIMIT);
  });

  it('clamps negative limit to 1', async () => {
    mockedGetRecentEvents.mockReturnValue([] as never);

    await registeredRoutes['/api/events'].handler({
      accessMode: 'insider',
      insiderScopes: null,
      query: { limit: '-5' },
    });

    expect(mockedGetRecentEvents).toHaveBeenCalledWith(1);
  });
});
