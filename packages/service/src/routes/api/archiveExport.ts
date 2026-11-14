/**
 * Directory archive export (ZIP/tar) for insiders: the archive streams as
 * the response body; entries and the size limit both honour the
 * caller's scopes.
 *
 * @packageDocumentation
 */

import path from 'node:path';

import { TarArchive, ZipArchive } from 'archiver';
import type { FastifyRequest } from 'fastify';

import { ArchiveTooLarge, InsiderRequired } from '../../api/errors.js';
import { ok } from '../../api/handlerTypes.js';
import { scopedEntryFilter } from '../../auth/scopeAccess.js';
import { getConfig } from '../../config/index.js';
import { attachmentDisposition } from '../../util/contentDisposition.js';
import { getDirSize } from '../../util/platform.js';

/** Supported directory archive formats. */
export type ArchiveFormat = 'zip' | 'tar';

/** True when `format` is a supported directory archive format. */
export function isArchiveFormat(format: string): format is ArchiveFormat {
  return format === 'zip' || format === 'tar';
}

/**
 * The directory at `resolved` (URL path `/${reqPath}`) as an archive
 * stream. Insider-only (`SERVER_INSIDER_REQUIRED` otherwise);
 * `SERVER_ARCHIVE_TOO_LARGE` when the in-scope content exceeds
 * `maxZipSizeMb`. Out-of-scope entries are omitted and not counted. A
 * failure while streaming is logged and ends the response.
 *
 * @param request - The request (access mode, scopes, logger).
 * @param resolved - The directory's filesystem path.
 * @param reqPath - Its URL path, without the leading slash.
 * @param format - The archive format.
 * @returns The 200 result: the stream and its headers.
 */
export function directoryArchive(
  request: FastifyRequest,
  resolved: string,
  reqPath: string,
  format: ArchiveFormat,
) {
  if (request.accessMode !== 'insider')
    throw new InsiderRequired('Archive export requires insider access');

  const includeEntry = scopedEntryFilter(`/${reqPath}`, request.insiderScopes);
  const { maxZipSizeMb } = getConfig();
  const totalSize = getDirSize(resolved, (rel) => includeEntry(rel, false));
  if (totalSize > maxZipSizeMb * 1024 * 1024) {
    throw new ArchiveTooLarge(
      String(Math.round(totalSize / 1024 / 1024)),
      String(maxZipSizeMb),
    );
  }

  const dirName = path.basename(resolved);
  const archive =
    format === 'tar'
      ? new TarArchive()
      : new ZipArchive({ zlib: { level: 6 } });
  const logFailure = (err: unknown) => {
    request.log.error({ err, path: resolved, format }, 'Archive export failed');
  };

  archive.on('error', logFailure);
  archive.directory(resolved, dirName, (entry) =>
    includeEntry(entry.name, entry.stats?.isDirectory() ?? false)
      ? entry
      : false,
  );
  // Finalizes as the response reads the stream.
  archive.finalize().catch(logFailure);
  return ok(archive, {
    'content-type': format === 'tar' ? 'application/x-tar' : 'application/zip',
    'content-disposition': attachmentDisposition(`${dirName}.${format}`),
  });
}
