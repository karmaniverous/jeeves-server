/**
 * File type detection and content-type mapping
 */

import mime from 'mime-types';

/**
 * Override map for extensions where mime-types returns an incorrect or
 * unhelpful result for our use case.
 */
const OVERRIDES: Record<string, string> = {
  '.mmd': 'text/plain; charset=utf-8',
  '.puml': 'text/plain; charset=utf-8',
  '.plantuml': 'text/plain; charset=utf-8',
  '.pu': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.jsonl': 'text/plain; charset=utf-8',
};

/**
 * Detect if a buffer looks like text (no null bytes in first 8KB)
 */
export function looksLikeText(buffer: Buffer): boolean {
  const checkSize = Math.min(buffer.length, 8192);
  for (let i = 0; i < checkSize; i++) {
    if (buffer[i] === 0) return false;
  }
  return true;
}

/**
 * Get content type for a file extension (with leading dot, e.g. '.md')
 */
export function getContentType(ext: string): string {
  const dotExt = ext.startsWith('.') ? ext : `.${ext}`;
  if (OVERRIDES[dotExt.toLowerCase()]) return OVERRIDES[dotExt.toLowerCase()];
  // mime-types expects extension without the dot
  return mime.contentType(dotExt.slice(1)) || 'application/octet-stream';
}

/**
 * Check if a content type should be displayed inline
 */
export function isInlineType(contentType: string): boolean {
  const inlineTypes = [
    'image/',
    'video/',
    'audio/',
    'text/',
    'application/pdf',
    'application/json',
    'application/xml',
  ];
  return inlineTypes.some((type) => contentType.startsWith(type));
}
