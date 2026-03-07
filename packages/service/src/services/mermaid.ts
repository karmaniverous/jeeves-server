/**
 * Mermaid diagram rendering service.
 *
 * Uses \@mermaid-js/mermaid-cli programmatic API with the server's configured Chrome.
 * Falls back to execSync shell-out if the programmatic API fails to load.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getConfig } from '../config/index.js';

/**
 * Render Mermaid source string to SVG via the mermaid-cli programmatic API.
 *
 * Uses the server's configured chromePath via puppeteerConfig.executablePath,
 * avoiding a separate Chromium download.
 *
 * Returns null on failure.
 */
export async function renderMermaidFromSource(
  source: string,
): Promise<string | null> {
  const config = getConfig();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmd-'));
  const inFile = path.join(tmpDir, 'diagram.mmd');
  const outFile = path.join(tmpDir, 'diagram.svg');

  try {
    fs.writeFileSync(inFile, source, 'utf8');

    // Dynamic import to avoid loading puppeteer at module parse time
    const { run } = await import('@mermaid-js/mermaid-cli');

    await run(inFile, outFile as `${string}.svg`, {
      quiet: true,
      outputFormat: 'svg',
      puppeteerConfig: {
        executablePath: config.chromePath,
        headless: 'shell',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
      parseMMDOptions: {
        backgroundColor: 'white',
        viewport: { width: 1600, height: 1200, deviceScaleFactor: 2 },
      },
    });

    if (!fs.existsSync(outFile)) return null;
    return fs.readFileSync(outFile, 'utf8');
  } catch (err) {
    console.error('[mermaid] render failed:', (err as Error).message);
    return null;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Render a .mmd file to SVG string.
 * Returns null on failure.
 */
export async function renderMermaidSvg(
  inputPath: string,
): Promise<string | null> {
  const source = fs.readFileSync(inputPath, 'utf8');
  return renderMermaidFromSource(source);
}

/**
 * Render a .mmd file to the specified format and return the output file path.
 * The caller is responsible for reading and cleaning up the output file.
 * Returns null on failure.
 */
export async function renderMermaidToFile(
  inputPath: string,
  format: string,
): Promise<string | null> {
  const config = getConfig();
  const resolved = path.resolve(inputPath);
  const outFile = path.join(
    path.dirname(resolved),
    `${path.basename(resolved, '.mmd')}.${format}`,
  );

  try {
    const { run } = await import('@mermaid-js/mermaid-cli');

    await run(resolved, outFile as `${string}.svg`, {
      quiet: true,
      outputFormat: format as 'svg' | 'png' | 'pdf',
      puppeteerConfig: {
        executablePath: config.chromePath,
        headless: 'shell',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
      parseMMDOptions: {
        backgroundColor: 'white',
        viewport: { width: 1600, height: 1200, deviceScaleFactor: 2 },
      },
    });

    if (fs.existsSync(outFile)) return outFile;
  } catch (err) {
    console.error('[mermaid] render to file failed:', (err as Error).message);
  }
  return null;
}
