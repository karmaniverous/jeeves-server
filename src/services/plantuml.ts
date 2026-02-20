/**
 * PlantUML rendering with fallback pipeline:
 * 1. Local Java jar (if configured) — supports !include directives
 * 2. Configured PlantUML servers (in order)
 * 3. Public community server (always last resort)
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import plantumlEncoder from 'plantuml-encoder';

import { getConfig } from '../config/index.js';

/**
 * Try rendering via local PlantUML jar.
 * Returns the output buffer, or null on failure.
 */
function renderViaJar(
  filePath: string,
  format: string,
): Buffer | null {
  const { plantuml } = getConfig();
  if (!plantuml.jarPath) return null;

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const outFile = path.join(dir, `${base}.${format}`);

  try {
    execSync(
      `java -jar "${plantuml.jarPath}" -t${format} "${filePath}"`,
      { timeout: 30_000, stdio: 'pipe', cwd: dir },
    );
    if (!fs.existsSync(outFile)) return null;
    const buffer = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch { /* ignore */ }
    return buffer;
  } catch {
    try { fs.unlinkSync(outFile); } catch { /* ignore */ }
    return null;
  }
}

/**
 * Try rendering via a PlantUML server endpoint.
 * Returns the output buffer, or null on failure.
 */
async function renderViaServer(
  source: string,
  format: string,
  serverUrl: string,
): Promise<Buffer | null> {
  try {
    const encoded = plantumlEncoder.encode(source);
    const url = `${serverUrl.replace(/\/+$/, '')}/${format}/${encoded}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!resp.ok) return null;
    return Buffer.from(await resp.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Render a PlantUML file with the full fallback pipeline.
 * Returns { buffer, method } or null if all methods fail.
 */
export async function renderPlantUml(
  filePath: string,
  format: string = 'svg',
): Promise<{ buffer: Buffer; method: string } | null> {
  // 1. Try local jar (supports includes)
  const jarResult = renderViaJar(filePath, format);
  if (jarResult) return { buffer: jarResult, method: 'jar' };

  // 2. Try configured servers in order
  const { plantuml } = getConfig();
  const source = fs.readFileSync(filePath, 'utf8');

  for (const server of plantuml.servers) {
    const serverResult = await renderViaServer(source, format, server);
    if (serverResult) return { buffer: serverResult, method: server };
  }

  return null;
}

/**
 * Render PlantUML to SVG string (convenience for file API).
 */
export async function renderPlantUmlSvg(filePath: string): Promise<string | null> {
  const result = await renderPlantUml(filePath, 'svg');
  if (!result) return null;
  return result.buffer.toString('utf8');
}

/**
 * Render PlantUML to buffer for export.
 */
export async function renderPlantUmlToBuffer(
  filePath: string,
  format: string,
): Promise<Buffer | null> {
  const result = await renderPlantUml(filePath, format);
  return result?.buffer ?? null;
}

/**
 * Get all export formats supported by PlantUML.
 */
export function getPlantUmlFormats(): string[] {
  // PlantUML jar supports all these; server supports svg/png/txt
  const { plantuml } = getConfig();
  if (plantuml.jarPath) {
    return ['svg', 'png', 'pdf', 'eps', 'txt', 'latex'];
  }
  // Server-only: limited formats
  return ['svg', 'png', 'txt'];
}
