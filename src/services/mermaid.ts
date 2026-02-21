/**
 * Mermaid diagram rendering service.
 *
 * Centralizes mermaid-cli (mmdc) invocation for both file viewing
 * and export endpoints.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { getConfig } from '../config/index.js';

/** Build the mmdc command prefix from config. */
function getMmcdCmd(): string {
  const config = getConfig();
  const prefix = config.mermaidCliPath ? `npx --prefix ${config.mermaidCliPath}` : 'npx';
  return `${prefix} mmdc`;
}

/**
 * Render a .mmd file to SVG string.
 * Returns null on failure.
 */
export function renderMermaidSvg(inputPath: string): string | null {
  const mmcdCmd = getMmcdCmd();
  const resolved = path.resolve(inputPath);
  const tmpOut = path.join(
    path.dirname(resolved),
    `.${path.basename(resolved, '.mmd')}.tmp.svg`,
  );
  try {
    execSync(
      `${mmcdCmd} -i "${resolved}" -o "${tmpOut}" -w 1600 -s 2 -b white -p puppeteer.json`,
      { timeout: 30_000, stdio: 'pipe' },
    );
    if (fs.existsSync(tmpOut)) {
      const svg = fs.readFileSync(tmpOut, 'utf8');
      fs.unlinkSync(tmpOut);
      return svg;
    }
  } catch {
    // Clean up temp file if it exists
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch { /* ignore */ }
  }
  return null;
}

/**
 * Render a .mmd file to the specified format and return the output file path.
 * The caller is responsible for reading and cleaning up the output file.
 * Returns null on failure.
 */
export function renderMermaidToFile(inputPath: string, format: string): string | null {
  const mmcdCmd = getMmcdCmd();
  const resolved = path.resolve(inputPath);
  const outFile = path.join(
    path.dirname(resolved),
    `${path.basename(resolved, '.mmd')}.${format}`,
  );
  try {
    execSync(
      `${mmcdCmd} -i "${resolved}" -o "${outFile}" -w 1600 -s 2 -b white -p puppeteer.json`,
      { timeout: 30_000, stdio: 'pipe' },
    );
    if (fs.existsSync(outFile)) return outFile;
  } catch {
    // fall through
  }
  return null;
}
