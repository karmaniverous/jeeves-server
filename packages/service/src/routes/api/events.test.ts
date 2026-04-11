import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the eventLog service
vi.mock('../../services/eventLog.js', () => ({
  getRecentEvents: vi.fn(),
}));

const { getRecentEvents } = await import('../../services/eventLog.js');
const mockedGetRecentEvents = vi.mocked(getRecentEvents);

// Capture the route registration
const registeredRoutes: Record<
  string,
  {
    method: string;
    path: string;
    handler: (request: { query: Record<string, string> }) => Promise<unknown>;
  }
> = {};

const mockFastify = {
  get: (
    path: string,
    handler: (request: { query: Record<string, string> }) => Promise<unknown>,
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
    const mockEvents = [{ id: '1', name: 'test' }];
    mockedGetRecentEvents.mockReturnValue(mockEvents as never);

    const result = await registeredRoutes['/api/events'].handler({
      query: {},
    });

    expect(mockedGetRecentEvents).toHaveBeenCalledWith(20);
    expect(result).toEqual(mockEvents);
  });

  it('respects custom limit', async () => {
    mockedGetRecentEvents.mockReturnValue([] as never);

    await registeredRoutes['/api/events'].handler({
      query: { limit: '50' },
    });

    expect(mockedGetRecentEvents).toHaveBeenCalledWith(50);
  });

  it('caps limit at 100', async () => {
    mockedGetRecentEvents.mockReturnValue([] as never);

    await registeredRoutes['/api/events'].handler({
      query: { limit: '999' },
    });

    expect(mockedGetRecentEvents).toHaveBeenCalledWith(100);
  });
});
