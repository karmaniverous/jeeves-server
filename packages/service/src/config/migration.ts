/**
 * Config path migration — handles old → new config path convention.
 *
 * Old convention: `<configDir>/jeeves-server.config.json`
 * New convention: `<configDir>/jeeves-server/config.json`
 */

import fs from 'node:fs';
import path from 'node:path';

const NON_JSON_EXTENSIONS = new Set([
  '.ts',
  '.yaml',
  '.yml',
  '.toml',
  '.mjs',
  '.cjs',
  '.js',
]);

/**
 * Migrate config path from old convention to new convention if needed.
 *
 * If the passed path matches the old convention (jeeves-server.config.json)
 * and the new path does not exist, migrates the file. If non-JSON config
 * is found, rejects with a clear error.
 *
 * @param configPath - The config path passed via --config CLI flag.
 * @returns The resolved config path (may be the new path after migration).
 */
export function migrateConfigPath(configPath: string): string {
  const ext = path.extname(configPath).toLowerCase();

  // Reject non-JSON config files
  if (NON_JSON_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported config file format: ${ext}\n` +
        `Only JSON configuration files are supported. ` +
        `Please convert your config to JSON format.`,
    );
  }

  const basename = path.basename(configPath);
  const configDir = path.dirname(configPath);

  // Check if this matches the old convention
  if (basename !== 'jeeves-server.config.json') {
    return configPath;
  }

  const newDir = path.join(configDir, 'jeeves-server');
  const newPath = path.join(newDir, 'config.json');

  // If new path already exists, use it
  if (fs.existsSync(newPath)) {
    console.log(
      `[config-migration] Using new config path: ${newPath} ` +
        `(old path ${configPath} is superseded)`,
    );
    return newPath;
  }

  // If old path exists, migrate it
  if (fs.existsSync(configPath)) {
    console.log(
      `[config-migration] Migrating config: ${configPath} → ${newPath}`,
    );
    fs.mkdirSync(newDir, { recursive: true });
    fs.renameSync(configPath, newPath);
    console.log(`[config-migration] Migration complete.`);
    return newPath;
  }

  // Neither exists — return the passed path for downstream error handling
  return configPath;
}
