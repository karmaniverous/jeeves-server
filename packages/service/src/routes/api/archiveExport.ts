/**
 * Directory archive export (ZIP/tar) for insiders. Streams the archive to
 * the hijacked response; entries and the size limit both honour the
 * caller's scopes.
 *
 * @packageDocumentation
 */

import path from 'node:path';

import { TarArchive, ZipArchive } from 'archiver';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { scopedEntryFilter } from '../../auth/scopeAccess.js';
import { getConfig } from '../../config/index.js';
import { getDirSize } from '../../util/platform.js';

/** Supported directory archive formats. */
export type ArchiveFormat = 'zip' | 'tar';

/** True when `format` is a supported directory archive format. */
export function isArchiveFormat(format: string): format is ArchiveFormat {
  return format === 'zip' || format === 'tar';
}

/**
 * Send the directory at `resolved` (URL path `/${reqPath}`) as an archive.
 * Insider-only (403 otherwise); 413 when the in-scope content exceeds
 * `maxZipSizeMb`. Out-of-scope entries are omitted and not counted.
 */
export async function sendDirectoryArchive(
  request: FastifyRequest,
  reply: FastifyReply,
  resolved: string,
  reqPath: string,
  format: ArchiveFormat,
): Promise<unknown> {
  if (request.accessMode !== 'insider')
    return reply
      .code(403)
      .send({ error: 'Archive export requires insider access' });

  const includeEntry = scopedEntryFilter(`/${reqPath}`, request.insiderScopes);
  const { maxZipSizeMb } = getConfig();
  const totalSize = getDirSize(resolved, (rel) => includeEntry(rel, false));
  if (totalSize > maxZipSizeMb * 1024 * 1024) {
    return reply.code(413).send({
      error: `Directory too large for archive export (${String(Math.round(totalSize / 1024 / 1024))}MB, max ${String(maxZipSizeMb)}MB)`,
    });
  }

  const dirName = path.basename(resolved);
  const archive =
    format === 'tar'
      ? new TarArchive()
      : new ZipArchive({ zlib: { level: 6 } });

  reply.hijack();
  const res = reply.raw;
  res.setHeader(
    'Content-Type',
    format === 'tar' ? 'application/x-tar' : 'application/zip',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${dirName}.${format}"`,
  );
  res.statusCode = 200;

  archive.on('error', (err: unknown) => {
    request.log.error({ err, path: resolved, format }, 'Archive export failed');
    res.destroy();
  });

  archive.pipe(res);
  archive.directory(resolved, dirName, (entry) =>
    includeEntry(entry.name, entry.stats?.isDirectory() ?? false)
      ? entry
      : false,
  );
  await archive.finalize();
  return undefined;
}
