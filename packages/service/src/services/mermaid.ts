/**
 * Mermaid diagram rendering service.
 *
 * Uses the \@mermaid-js/mermaid-cli programmatic API with the server's
 * configured Chrome. Every render writes into a private temp directory that
 * is removed afterwards; nothing is ever written next to the source file.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getConfig } from '../config/index.js';

/** Output formats mermaid-cli can produce. */
export type MermaidFormat = 'svg' | 'png' | 'pdf';

/**
 * Render `inFile` to `<temp dir>/diagram.<format>` and return the bytes, or
 * null when the render fails or produces no output. The temp directory is
 * removed on success and failure.
 */
async function renderInTempDir(
  format: MermaidFormat,
  inFileFor: (tmpDir: string) => string,
): Promise<Buffer | null> {
  const config = getConfig();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmd-'));
  const outFile = path.join(tmpDir, `diagram.${format}`);

  try {
    const inFile = inFileFor(tmpDir);

    // Dynamic import to avoid loading puppeteer at module parse time
    const { run } = await import('@mermaid-js/mermaid-cli');

    await run(inFile, outFile as `${string}.${MermaidFormat}`, {
      quiet: true,
      outputFormat: format,
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

    return fs.existsSync(outFile) ? fs.readFileSync(outFile) : null;
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
  const svg = await renderInTempDir('svg', (tmpDir) => {
    const inFile = path.join(tmpDir, 'diagram.mmd');
    fs.writeFileSync(inFile, source, 'utf8');
    return inFile;
  });
  return svg ? svg.toString('utf8') : null;
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
 * Render a .mmd file to the specified format and return the bytes.
 * Output goes to a private temp directory that is removed afterwards, so
 * files beside the source are never created or overwritten (#281).
 * Returns null on failure.
 */
export async function renderMermaidToBuffer(
  inputPath: string,
  format: MermaidFormat,
): Promise<Buffer | null> {
  const resolved = path.resolve(inputPath);
  return renderInTempDir(format, () => resolved);
}
