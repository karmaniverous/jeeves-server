/**
 * The README usage example, compiled by `tsc` and run against a stub server, so the documented calls, types and error handling stay true.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  createServerClient,
  isServerError,
  toExportUrl,
  toRawUrl,
} from './index.js';

const insiderKey = 'insider-key';

/** Stub server: a listing, a share, PDF bytes, then a 403. */
const serverReply = (url: string): Response => {
  const { pathname } = new URL(url);
  if (pathname.startsWith('/api/path/'))
    return Response.json({
      path: '/j/docs',
      breadcrumbs: [],
      entries: [],
      isInsider: true,
    });
  if (pathname === '/api/share')
    return Response.json({
      url: '/browse/j/docs/report.md?k=pk',
      path: '/j/docs/report.md',
      exp: null,
      depth: 0,
      dirs: false,
      isDirectory: false,
    });
  if (pathname.startsWith('/api/export/'))
    return new Response(new Uint8Array([37, 80, 68, 70]));
  return Response.json(
    {
      statusCode: 403,
      code: 'SERVER_OUT_OF_SCOPE',
      error: 'Forbidden',
      message: 'Path is outside your scopes',
    },
    { status: 403 },
  );
};

describe('README usage', () => {
  it('runs as documented', async () => {
    const log = vi.fn();
    const fetch = vi.fn((url: string) => Promise.resolve(serverReply(url)));

    // --- README example ---
    const server = createServerClient({
      baseUrl: 'http://127.0.0.1:1934',
      auth: { key: insiderKey },
      fetch,
    });

    const listing = await server.browse({ '*': 'j/docs' });
    const { url } = await server.share({ path: '/j/docs/report.md' });
    const pdf = await server.export({ '*': 'j/docs/report.md', format: 'pdf' });

    const rawUrl = toRawUrl(`https://jeeves.example.com${url}`);
    const docxUrl = toExportUrl(`https://jeeves.example.com${url}`, 'docx');

    try {
      await server.fileContent({ '*': 'j/private/notes.md' });
    } catch (error) {
      if (isServerError(error) && error.code === 'SERVER_OUT_OF_SCOPE') {
        log(`${error.message} (HTTP ${String(error.status)})`);
      } else throw error;
    }
    // --- end ---

    expect(listing).toMatchObject({ path: '/j/docs', isInsider: true });
    expect([...pdf]).toEqual([37, 80, 68, 70]);
    expect(rawUrl).toBe(
      'https://jeeves.example.com/api/raw/j/docs/report.md?k=pk',
    );
    expect(docxUrl).toBe(
      'https://jeeves.example.com/api/export/j/docs/report.md?k=pk&format=docx',
    );
    expect(log).toHaveBeenCalledWith('Path is outside your scopes (HTTP 403)');
    expect(fetch.mock.calls[0]?.[0]).toBe(
      'http://127.0.0.1:1934/api/path/j/docs?k=insider-key',
    );
  });
});
