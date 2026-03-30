/* eslint-disable no-undef */

/**
 * Downloads a pinned PlantUML jar to vendor/plantuml.jar.
 * Run automatically via postinstall, or manually: node scripts/download-plantuml.js
 *
 * The jar is gitignored and server-side only (never touches the client build).
 * To upgrade PlantUML: bump PLANTUML_VERSION below and run npm install.
 */

import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLANTUML_VERSION = 'v1.2026.2';
const PLANTUML_URL = `https://github.com/plantuml/plantuml/releases/download/${PLANTUML_VERSION}/plantuml-${PLANTUML_VERSION.slice(1)}.jar`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vendorDir = path.resolve(__dirname, '..', 'vendor');
const jarPath = path.join(vendorDir, 'plantuml.jar');
const versionFile = path.join(vendorDir, '.plantuml-version');

// Skip if already downloaded at this version
if (fs.existsSync(jarPath) && fs.existsSync(versionFile)) {
  const currentVersion = fs.readFileSync(versionFile, 'utf8').trim();
  if (currentVersion === PLANTUML_VERSION) {
    console.log(`PlantUML ${PLANTUML_VERSION} already present, skipping download.`);
    process.exit(0);
  }
}

fs.mkdirSync(vendorDir, { recursive: true });

console.log(`Downloading PlantUML ${PLANTUML_VERSION}...`);

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (url) => {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${String(res.statusCode)} downloading PlantUML`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
}

try {
  await download(PLANTUML_URL, jarPath);
  fs.writeFileSync(versionFile, PLANTUML_VERSION);
  const stats = fs.statSync(jarPath);
  console.log(`PlantUML ${PLANTUML_VERSION} downloaded (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
} catch (err) {
  console.warn(`Warning: Failed to download PlantUML: ${err.message}`);
  console.warn('PlantUML local rendering will fall back to server-based rendering.');
  // Don't fail the install — PlantUML is optional
  process.exit(0);
}
