/**
 * CLI for installing/uninstalling the jeeves-server OpenClaw plugin.
 *
 * Usage:
 *   npx \@karmaniverous/jeeves-server-openclaw install
 *   npx \@karmaniverous/jeeves-server-openclaw uninstall
 *
 * Supports non-default installations via:
 *   - OPENCLAW_CONFIG env var (path to openclaw.json)
 *   - OPENCLAW_HOME env var (path to .openclaw directory)
 *   - Default: ~/.openclaw/openclaw.json
 *
 * @module cli
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  patchConfig,
  removeManagedSection,
  resolveConfigPath,
  resolveOpenClawHome,
} from '@karmaniverous/jeeves';

import { PLUGIN_ID } from './constants.js';
import { removePlugin } from './pluginRemove.js';

/** Get the package root (where this CLI lives). */
function getPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

/** Read and parse JSON, returning null on failure. */
function readJson(p: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Write JSON with 2-space indent + trailing newline. */
function writeJson(p: string, data: unknown): void {
  writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

/** Install the plugin into OpenClaw's extensions directory. */
function install(): void {
  const home = resolveOpenClawHome();
  const configPath = resolveConfigPath(home);
  const extDir = join(home, 'extensions', PLUGIN_ID);
  const pkgRoot = getPackageRoot();

  console.log(`OpenClaw home:  ${home}`);
  console.log(`Config:         ${configPath}`);
  console.log(`Extensions dir: ${extDir}`);
  console.log(`Package root:   ${pkgRoot}`);
  console.log();

  if (!existsSync(home)) {
    console.error(`Error: OpenClaw home directory not found at ${home}`);
    console.error(
      'Set OPENCLAW_HOME or OPENCLAW_CONFIG if using a non-default installation.',
    );
    process.exit(1);
  }

  if (!existsSync(configPath)) {
    console.error(`Error: OpenClaw config not found at ${configPath}`);
    console.error(
      'Set OPENCLAW_CONFIG if using a non-default config location.',
    );
    process.exit(1);
  }

  // Copy package to extensions directory
  console.log('Copying plugin to extensions directory...');
  if (existsSync(extDir)) rmSync(extDir, { recursive: true, force: true });
  mkdirSync(extDir, { recursive: true });

  for (const file of ['dist', 'openclaw.plugin.json', 'package.json']) {
    const src = join(pkgRoot, file);
    const dest = join(extDir, file);
    if (existsSync(src)) {
      cpSync(src, dest, { recursive: true });
      console.log(`  \u2713 ${file}`);
    }
  }

  const nodeModulesSrc = join(pkgRoot, 'node_modules');
  if (existsSync(nodeModulesSrc)) {
    cpSync(nodeModulesSrc, join(extDir, 'node_modules'), { recursive: true });
    console.log('  \u2713 node_modules');
  }

  // Patch config
  console.log();
  console.log('Patching OpenClaw config...');
  const config = readJson(configPath);
  if (!config) {
    console.error(`Error: Could not parse ${configPath}`);
    process.exit(1);
  }

  for (const msg of patchConfig(config, PLUGIN_ID, 'add')) {
    console.log(`  \u2713 ${msg}`);
  }
  writeJson(configPath, config);

  console.log();
  console.log('\u2705 Plugin installed successfully.');
  console.log('   Restart the OpenClaw gateway to load the plugin.');
}

/** Uninstall the plugin from OpenClaw's extensions directory. */
async function uninstall(): Promise<void> {
  const home = resolveOpenClawHome();
  const configPath = resolveConfigPath(home);

  console.log(`OpenClaw home:  ${home}`);
  console.log(`Config:         ${configPath}`);
  console.log();

  // Delegate extension removal + config patching to shared module
  for (const msg of removePlugin(home, configPath)) {
    console.log(`  \u2713 ${msg}`);
  }

  // Remove managed TOOLS.md section
  const toolsPath = join(process.cwd(), 'TOOLS.md');
  if (existsSync(toolsPath)) {
    console.log('Removing managed TOOLS.md section...');
    await removeManagedSection(toolsPath, { sectionId: 'Server' });
    console.log('  \u2713 Removed Server section from TOOLS.md');
  }

  console.log();
  console.log('\u2705 Plugin uninstalled successfully.');
  console.log('   Restart the OpenClaw gateway to complete removal.');
}

// Main
const command = process.argv[2];

switch (command) {
  case 'install':
    install();
    break;
  case 'uninstall':
    void uninstall();
    break;
  default:
    console.log(
      '@karmaniverous/jeeves-server-openclaw \u2014 OpenClaw plugin installer',
    );
    console.log();
    console.log('Usage:');
    console.log(
      '  npx @karmaniverous/jeeves-server-openclaw install    Install plugin',
    );
    console.log(
      '  npx @karmaniverous/jeeves-server-openclaw uninstall  Remove plugin',
    );
    console.log();
    console.log('Environment variables:');
    console.log('  OPENCLAW_CONFIG  Path to openclaw.json (overrides all)');
    console.log('  OPENCLAW_HOME    Path to .openclaw directory');
    console.log();
    console.log('Default: ~/.openclaw/openclaw.json');
    if (
      command &&
      command !== 'help' &&
      command !== '--help' &&
      command !== '-h'
    ) {
      console.error(`\nUnknown command: ${command}`);
      process.exit(1);
    }
    break;
}
