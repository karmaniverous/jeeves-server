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
 * Standard content-type map for diagram export formats.
 */
export const DIAGRAM_CONTENT_TYPES: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  pdf: 'application/pdf',
  eps: 'application/postscript',
  txt: 'text/plain; charset=utf-8',
  latex: 'application/x-latex',
};

/**
 * Map file extensions to highlight.js language identifiers.
 */
const EXT_LANG_MAP: Record<string, string> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.tsx': 'typescript',
  '.jsx': 'javascript',
  '.json': 'json',
  '.jsonl': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.html': 'xml',
  '.htm': 'xml',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.ps1': 'powershell',
  '.bat': 'dos',
  '.cmd': 'dos',
  '.sql': 'sql',
  '.md': 'markdown',
  '.ini': 'ini',
  '.toml': 'ini',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.lua': 'lua',
  '.php': 'php',
  '.r': 'r',
  '.pl': 'perl',
};

/**
 * Get the highlight.js language identifier for a file extension.
 * Returns null if not in the known map.
 */
export function getLanguageForExt(ext: string): string | null {
  return EXT_LANG_MAP[ext.toLowerCase()] ?? null;
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
