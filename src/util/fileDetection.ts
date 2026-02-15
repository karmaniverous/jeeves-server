/**
 * File type detection and content-type mapping
 */

/**
 * Dangerous executable extensions that should not be linked
 */
export const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.msi',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.pif',
  '.vbs',
  '.vbe',
  '.jse',
  '.ws',
  '.wsf',
  '.wsc',
  '.wsh',
  '.ps1',
  '.reg',
  '.inf',
  '.hta',
  '.dll',
  '.so',
  '.dylib',
];

/**
 * Content type mapping by file extension
 */
export const CONTENT_TYPES: Record<string, string> = {
  // Text files
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.jsonl': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.mmd': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Archives
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.7z': 'application/x-7z-compressed',
  '.rar': 'application/vnd.rar',
  // Audio/Video
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
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
 * Get content type for a file extension
 */
export function getContentType(ext: string): string {
  return CONTENT_TYPES[ext.toLowerCase()] || 'application/octet-stream';
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
