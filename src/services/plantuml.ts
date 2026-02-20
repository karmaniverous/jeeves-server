/**
 * PlantUML rendering via local Java jar.
 *
 * Renders diagrams locally, supporting !include directives and all
 * PlantUML features. Requires Java and the PlantUML jar on the server.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { getConfig } from '../config/index.js';

/**
 * Render a PlantUML file to SVG using the local jar.
 * Returns the SVG string, or null on failure.
 */
export function renderPlantUml(filePath: string): string | null {
  const config = getConfig();
  const jarPath = config.plantumlJarPath;
  if (!jarPath) return null;

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  // PlantUML outputs {basename}.svg in the output directory
  const outFile = path.join(dir, `${base}.svg`);

  try {
    execSync(
      `java -jar "${jarPath}" -tsvg "${filePath}"`,
      { timeout: 30_000, stdio: 'pipe', cwd: dir },
    );

    if (!fs.existsSync(outFile)) return null;

    const svg = fs.readFileSync(outFile, 'utf8');
    try { fs.unlinkSync(outFile); } catch { /* ignore */ }
    return svg;
  } catch (err) {
    try { fs.unlinkSync(outFile); } catch { /* ignore */ }
    return null;
  }
}

/**
 * Render PlantUML file to a specific format and return the buffer.
 * Used for export endpoints.
 */
export function renderPlantUmlToBuffer(
  filePath: string,
  format: 'svg' | 'png',
): Buffer | null {
  const config = getConfig();
  const jarPath = config.plantumlJarPath;
  if (!jarPath) return null;

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const outFile = path.join(dir, `${base}.${format}`);

  try {
    const formatFlag = format === 'png' ? '-tpng' : '-tsvg';
    execSync(
      `java -jar "${jarPath}" ${formatFlag} "${filePath}"`,
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
