/**
 * Code syntax highlighting using highlight.js
 */

import hljs from 'highlight.js';

/**
 * Language mapping by file extension
 */
const LANG_MAP: Record<string, string> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
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
  '.md': 'markdown',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.cc': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.ps1': 'powershell',
  '.psm1': 'powershell',
  '.bat': 'dos',
  '.cmd': 'dos',
  '.sql': 'sql',
  '.ini': 'ini',
  '.conf': 'ini',
  '.cfg': 'ini',
  '.dockerfile': 'dockerfile',
  '.makefile': 'makefile',
};

/**
 * Highlight code with optional language hint from file extension
 */
export function highlightCode(
  code: string,
  ext: string,
): { highlighted: string; language: string | null } {
  const lang = LANG_MAP[ext.toLowerCase()] ?? null;

  let highlighted: string;
  try {
    if (lang) {
      highlighted = hljs.highlight(code, { language: lang }).value;
    } else {
      highlighted = hljs.highlightAuto(code).value;
    }
  } catch {
    // Fallback to escaped HTML
    highlighted = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return { highlighted, language: lang };
}
