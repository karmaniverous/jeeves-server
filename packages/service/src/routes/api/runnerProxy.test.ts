import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@karmaniverous/jeeves', () => ({
  getServiceUrl: vi.fn(() => 'http://runner.test'),
}));

vi.mock('./scopeGuard.js', () => ({
  rejectNonInsider: vi.fn(() => false),
}));

type RouteHandler = (
  request: { params?: Record<string, string>; query?: Record<string, string> },
  reply: FakeReply,
) => Promise<void>;

interface FakeReply {
  code: (status: number) => FakeReply;
  header: (name: string, value: string) => FakeReply;
  send: (body: string) => FakeReply;
}

let routes: Record<string, { method: string; handler: RouteHandler }> = {};

const mockFastify = {
  addHook: () => undefined,
  get: (path: string, handler: RouteHandler) => {
    routes[path] = { method: 'GET', handler };
  },
  post: (path: string, handler: RouteHandler) => {
    routes[path] = { method: 'POST', handler };
  },
};

function createReply(): FakeReply & { status: number; body: string } {
  const reply = {
    status: 0,
    body: '',
    code(status: number) {
      reply.status = status;
      return reply;
    },
    header() {
      return reply;
    },
    send(body: string) {
      reply.body = body;
      return reply;
    },
  };
  return reply;
}

const fetchMock = vi.fn();

describe('runner proxy routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    routes = {};
    fetchMock.mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { runnerRoutes } = await import('./runner.js');
    runnerRoutes(mockFastify as never, {}, () => undefined);
  });

  it('proxies enable to the runner with PATCH', async () => {
    const reply = createReply();
    await routes['/api/runner/jobs/:id/enable'].handler(
      { params: { id: 'nightly' } },
      reply,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://runner.test/jobs/nightly/enable',
      { method: 'PATCH' },
    );
    expect(reply.status).toBe(200);
    expect(reply.body).toBe('{"ok":true}');
  });

  it('proxies disable to the runner with PATCH', async () => {
    const reply = createReply();
    await routes['/api/runner/jobs/:id/disable'].handler(
      { params: { id: 'nightly' } },
      reply,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://runner.test/jobs/nightly/disable',
      { method: 'PATCH' },
    );
    expect(reply.status).toBe(200);
  });

  it('keeps run-now as POST', async () => {
    const reply = createReply();
    await routes['/api/runner/jobs/:id/run'].handler(
      { params: { id: 'nightly' } },
      reply,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://runner.test/jobs/nightly/run',
      { method: 'POST' },
    );
  });

  it('keeps job listing as GET', async () => {
    const reply = createReply();
    await routes['/api/runner/jobs'].handler({}, reply);

    expect(fetchMock).toHaveBeenCalledWith('http://runner.test/jobs', {
      method: 'GET',
    });
  });

  it('forwards non-2xx runner responses instead of swallowing them', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":"not found"}', {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const reply = createReply();
    await routes['/api/runner/jobs/:id/enable'].handler(
      { params: { id: 'nightly' } },
      reply,
    );

    expect(reply.status).toBe(404);
    expect(reply.body).toBe('{"error":"not found"}');
  });

  it('answers 502 when the runner is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const reply = createReply();
    await routes['/api/runner/jobs/:id/disable'].handler(
      { params: { id: 'nightly' } },
      reply,
    );

    expect(reply.status).toBe(502);
    expect(reply.body).toContain('Runner unreachable');
  });
});
