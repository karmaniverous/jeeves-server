/**
 * The composed sharing tools on the SDK: `server_share` (`share`, or `shareFor` for named insiders; page and raw URLs from the SDK's link helpers, #278) and `server_export` (a download URL, never bytes: unkeyed, or derived from a signed share; Decisions 19 and 21).
 *
 * @packageDocumentation
 */

import type { ToolDescriptor } from '@karmaniverous/jeeves';
import {
  type ExportFormat,
  type ServerClient,
  toExportUrl,
  toRawUrl,
} from '@karmaniverous/jeeves-server-sdk';

import { exportFormatsFor } from './exportFormats.js';
import { runServerCall, type ToolContext } from './sdkCall.js';
import {
  SERVER_EXPORT_PARAMETERS,
  SERVER_SHARE_PARAMETERS,
} from './shareToolParameters.js';
import { normalizePath, toAbsoluteUrl } from './toolUtils.js';

/** Milliseconds in one day. */
const MS_PER_DAY = 86_400_000;

/** `share` expiry (Unix ms, as a string) `days` from now; none when omitted. */
function expiryOf(days: unknown): { expiry?: string } {
  return typeof days === 'number'
    ? { expiry: String(Math.round(Date.now() + days * MS_PER_DAY)) }
    : {};
}

/** The unkeyed page URL of a browse path. */
function pageUrl(baseUrl: string, path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl.replace(/\/+$/, '')}/browse/${encoded}`;
}

/** The given ones of `names` from `params`. */
function pick(
  params: Record<string, unknown>,
  names: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    names.flatMap((name) =>
      params[name] === undefined ? [] : [[name, params[name]]],
    ),
  );
}

/**
 * Sign a share and return its absolute page URL.
 *
 * @param client - SDK client.
 * @param baseUrl - Server URL.
 * @param body - Share body.
 * @returns The share response, with `url` absolute.
 */
async function signShare(
  client: ServerClient,
  baseUrl: string,
  body: Parameters<ServerClient['share']>[0],
) {
  const result = await client.share(body);
  return { ...result, url: toAbsoluteUrl(baseUrl, result.url) };
}

/** `server_share`: params as in 0.15.0. */
function shareTool(context: ToolContext): ToolDescriptor {
  return {
    name: 'server_share',
    description:
      'Generate a share link for a path. Returns an HMAC-signed page URL, plus a raw URL (rawUrl) for file shares, plain or deep; directory shares have no rawUrl. Takes optional expiry, link-following depth and dirs. A plain directory share (no depth, no dirs) covers the whole tree below it. When insiders are specified, uses the share-for endpoint to target specific audience members.',
    parameters: SERVER_SHARE_PARAMETERS,
    execute: (_id, params) =>
      runServerCall(context, async (client, baseUrl) => {
        const path = '/' + normalizePath(params);
        const deep = pick(params, ['depth', 'dirs']);
        if (Array.isArray(params.insiders) && params.insiders.length > 0)
          return client.shareFor({
            path,
            insiders: params.insiders as string[],
            ...deep,
            ...pick(params, ['enforceOutsiderPolicy']),
          });
        const shared = await signShare(client, baseUrl, {
          path,
          ...expiryOf(params.expiryDays),
          ...deep,
        });
        const page = { ...shared, pageUrl: shared.url };
        // A file share's key, plain or deep, verifies on /api/raw/ too;
        // directory shares have no raw URL.
        return shared.isDirectory
          ? page
          : { ...page, rawUrl: toRawUrl(shared.url) };
      }),
  };
}

/** `server_export`: a download URL for a path in a format. */
function exportTool(context: ToolContext): ToolDescriptor {
  return {
    name: 'server_export',
    description:
      'Get a download URL for an export of a file or directory: pdf or docx for Markdown documents, zip or tar for directories, svg or png for Mermaid (.mmd) and PlantUML (.puml, .plantuml) diagrams. The URL carries no key and opens in an insider browser session; with share, it carries a signed share (optionally expiring) so anyone with the link can download it. Exports render when the URL is opened (Chrome for PDF).',
    parameters: SERVER_EXPORT_PARAMETERS,
    execute: (_id, params) =>
      runServerCall(context, async (client, baseUrl) => {
        const path = normalizePath(params);
        const format = String(params.format) as ExportFormat;
        const info = await client.linkInfo({ '*': path });
        if (!info.exists) throw new Error(`Not found: ${path}`);
        const valid = exportFormatsFor(path, info.isDirectory === true);
        if (!valid.includes(format))
          throw new Error(
            valid.length === 0
              ? `${path} has no export formats`
              : `Format "${format}" is not available for ${path}; use ${valid.join(', ')}`,
          );
        const share = params.share as { expiryDays?: unknown } | undefined;
        if (share === undefined)
          return {
            path,
            format,
            url: toExportUrl(pageUrl(baseUrl, path), format),
          };
        const shared = await signShare(client, baseUrl, {
          path: '/' + path,
          ...expiryOf(share.expiryDays),
        });
        return {
          path,
          format,
          url: toExportUrl(shared.url, format),
          exp: shared.exp,
        };
      }),
  };
}

/**
 * Build the sharing tools.
 *
 * @param context - Plugin API and public URL.
 * @returns `server_share` and `server_export`.
 */
export function createShareTools(context: ToolContext): ToolDescriptor[] {
  return [shareTool(context), exportTool(context)];
}
