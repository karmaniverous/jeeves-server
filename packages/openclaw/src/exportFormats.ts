/**
 * Which export formats `server_export` offers for a path: `pdf`/`docx` for Markdown documents, `zip`/`tar` for directories, `svg`/`png` for Mermaid and PlantUML sources. Pure.
 *
 * @packageDocumentation
 */

import type { ExportFormat } from '@karmaniverous/jeeves-server-sdk';

/** Every format, in the order the tool lists them. */
export const EXPORT_FORMATS: readonly ExportFormat[] = [
  'pdf',
  'docx',
  'zip',
  'tar',
  'svg',
  'png',
];

/** Formats by file extension (lower case). */
const FILE_FORMATS: ReadonlyMap<string, readonly ExportFormat[]> = new Map([
  ['.md', ['pdf', 'docx']],
  ['.markdown', ['pdf', 'docx']],
  ['.mmd', ['svg', 'png']],
  ['.puml', ['svg', 'png']],
  ['.plantuml', ['svg', 'png']],
]);

/** Directory formats. */
const DIRECTORY_FORMATS: readonly ExportFormat[] = ['zip', 'tar'];

/**
 * The export formats of a path.
 *
 * @param path - Browse path.
 * @param isDirectory - Whether it is a directory.
 * @returns The formats (empty when the path has none).
 */
export function exportFormatsFor(
  path: string,
  isDirectory: boolean,
): readonly ExportFormat[] {
  if (isDirectory) return DIRECTORY_FORMATS;
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? [] : (FILE_FORMATS.get(name.slice(dot).toLowerCase()) ?? []);
}
