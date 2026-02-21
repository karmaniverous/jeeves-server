/**
 * Mermaid diagram rendering service.
 *
 * Centralizes mermaid-cli (mmdc) invocation for both file viewing
 * and export endpoints.
 */

import fs from 'node:fs';
import os from 'node:os';
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
 * Render Mermaid source string to SVG.
 * Writes to a temp file, renders, reads output, cleans up.
 * Returns null on failure.
 */
export function renderMermaidFromSource(source: string): string | null {
  const config = getConfig();
  const cliPath = config.mermaidCliPath;
  if (!cliPath) return null;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmd-'));
  const inFile = path.join(tmpDir, 'diagram.mmd');
  const outFile = path.join(tmpDir, 'diagram.svg');

  try {
    fs.writeFileSync(inFile, source, 'utf8');

    const puppeteerConfig = path.resolve('puppeteer.json');
    const puppeteerArg = fs.existsSync(puppeteerConfig)
      ? ` -p "${puppeteerConfig}"`
      : '';

    const mmcdCmd = getMmcdCmd();
    execSync(
      `${mmcdCmd} -i "${inFile}" -o "${outFile}" -w 1600 -s 2 -b white${puppeteerArg}`,
      { timeout: 30_000, stdio: 'pipe' },
    );

    if (!fs.existsSync(outFile)) return null;
    return fs.readFileSync(outFile, 'utf8');
  } catch (err) {
    console.error('[mermaid] render failed:', (err as Error).message);
    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/**
 * Render a .mmd file to SVG string.
 * Returns null on failure.
 */
export function renderMermaidSvg(inputPath: string): string | null {
  const source = fs.readFileSync(inputPath, 'utf8');
  return renderMermaidFromSource(source);
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
