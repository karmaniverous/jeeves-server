/**
 * Downloads: fetch a Download menu entry's bytes with the page's credential
 * through the SDK's binary entries, and save them as a browser download
 * under the name the client gives it (the SDK exposes no response headers).
 * A failure is thrown as the SDK's `ServerError`, so it shows in the app.
 */

import type { ServerClient } from '@karmaniverous/jeeves-server-sdk';

import type { DownloadItem, DownloadRequest } from './downloadItems';

/** The SDK entries downloads use. */
export type DownloadClient = Pick<
  ServerClient,
  'raw' | 'export' | 'exportMermaid' | 'exportPlantUml'
>;

/**
 * Fetch a download's bytes.
 *
 * @param api - The SDK client.
 * @param path - Browse path of the file or directory.
 * @param request - The entry (and format) to fetch.
 * @returns The bytes.
 */
export function fetchDownload(
  api: DownloadClient,
  path: string,
  request: DownloadRequest,
): Promise<Uint8Array> {
  switch (request.entry) {
    case 'raw':
      return api.raw({ '*': path });
    case 'export':
      return api.export({ '*': path, format: request.format });
    default:
      return api[request.entry]({ '*': path, format: request.format });
  }
}

/**
 * Save bytes as a browser download.
 *
 * @param bytes - The file's bytes.
 * @param filename - The name to save it as.
 */
export function saveBytes(bytes: Uint8Array, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Fetch a Download menu entry and save it under its file name.
 *
 * @param api - The SDK client.
 * @param path - Browse path of the file or directory.
 * @param item - The menu entry.
 */
export async function download(
  api: DownloadClient,
  path: string,
  item: DownloadItem,
): Promise<void> {
  saveBytes(await fetchDownload(api, path, item.request), item.filename);
}
