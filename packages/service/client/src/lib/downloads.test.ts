import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useActionState } from '@/components/useActionState';
import { renderHook, settle } from '@/test/reactHarness';

import { createAppClient } from './appClient';
import { getDownloadItems } from './downloadItems';
import { download, fetchDownload } from './downloads';

const origin = 'http://jeeves.test';
const share = { k: 'abc', exp: '9' };

/** Stub `fetch` with one response; returns the mock. */
function stubFetch(response: Response) {
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/** The URL the stubbed fetch was called with. */
function sentUrl(fetch: ReturnType<typeof vi.fn>): URL {
  const [input] = fetch.mock.calls[0] as [string | URL | Request];
  return new URL(input instanceof Request ? input.url : String(input));
}

/** The menu entry labelled `label` for `path`. */
function item(path: string, label: string, isDirectory = false) {
  const file = isDirectory ? null : { fileName: 'a.md', type: 'markdown' };
  const found = getDownloadItems(path, file, isDirectory, true).find(
    (i) => i.label === label,
  );
  if (!found) throw new Error(`no ${label} item`);
  return found;
}

let saved: { name: string; blob: Blob }[];

beforeEach(() => {
  saved = [];
  let blob: Blob | undefined;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
    blob = b as Blob;
    return 'blob:download';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (blob) saved.push({ name: this.download, blob });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('download', () => {
  it('fetches a PDF export with the page credential and saves it as <base>.pdf', async () => {
    const fetch = stubFetch(new Response(new Uint8Array([1, 2, 3])));
    const api = createAppClient({ origin, share });
    await download(api, 'j/docs/a.md', item('j/docs/a.md', 'PDF'));

    const url = sentUrl(fetch);
    expect(url.pathname).toBe('/api/export/j/docs/a.md');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      format: 'pdf',
      k: 'abc',
      exp: '9',
    });
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('a.pdf');
    expect(new Uint8Array(await saved[0].blob.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it('names a directory archive <dir>.zip', async () => {
    const fetch = stubFetch(new Response(new Uint8Array([9])));
    const api = createAppClient({ origin, share: undefined });
    await download(api, 'j/docs', item('j/docs', 'ZIP', true));
    expect(sentUrl(fetch).search).toBe('?format=zip');
    expect(saved.map((s) => s.name)).toEqual(['docs.zip']);
  });

  it.each([
    ['Raw', '/api/raw/j/docs/a.md', ''],
    ['DOCX', '/api/export/j/docs/a.md', '?format=docx'],
  ])('fetches %s from its entry', async (label, pathname, search) => {
    const fetch = stubFetch(new Response(new Uint8Array([0])));
    const api = createAppClient({ origin, share: undefined });
    await fetchDownload(api, 'j/docs/a.md', item('j/docs/a.md', label).request);
    expect(sentUrl(fetch).pathname).toBe(pathname);
    expect(sentUrl(fetch).search).toBe(search);
  });

  it('fetches diagram exports from their entries', async () => {
    const fetch = stubFetch(new Response(new Uint8Array([0])));
    const api = createAppClient({ origin, share: undefined });
    await fetchDownload(api, 'j/d.puml', {
      entry: 'exportPlantUml',
      format: 'eps',
    });
    expect(sentUrl(fetch).pathname).toBe('/api/plantuml-export/j/d.puml');
    expect(sentUrl(fetch).search).toBe('?format=eps');
  });

  it('shows a failed download in the app by its code, saving nothing', async () => {
    stubFetch(
      new Response(
        JSON.stringify({
          statusCode: 503,
          code: 'SERVER_CHROME_UNAVAILABLE',
          error: 'Service Unavailable',
          message: 'PDF export needs Chrome',
        }),
        { status: 503, headers: { 'content-type': 'application/json' } },
      ),
    );
    const api = createAppClient({ origin, share: undefined });
    const onError = vi.fn();
    const hook = await renderHook(() => useActionState(onError), {});
    await settle(() => {
      void hook.result.current?.handleAction(() =>
        download(api, 'j/docs/a.md', item('j/docs/a.md', 'PDF')),
      );
    });
    expect(hook.result.current?.state).toBe('error');
    expect(hook.result.current?.errorMsg).toBe('PDF export needs Chrome');
    expect(onError).toHaveBeenCalledWith('PDF export needs Chrome');
    expect(saved).toEqual([]);
    await hook.unmount();
  });
});
