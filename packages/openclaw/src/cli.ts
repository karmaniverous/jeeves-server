/**
 * CLI for installing/uninstalling the jeeves-server OpenClaw plugin.
 *
 * Usage:
 *   npx @karmaniverous/jeeves-server-openclaw install
 *   npx @karmaniverous/jeeves-server-openclaw uninstall
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const PLUGIN_ID = 'jeeves-server-openclaw';

function resolveOpenClawHome(): string {
  if (process.env.OPENCLAW_CONFIG)
    return dirname(resolve(process.env.OPENCLAW_CONFIG));
  if (process.env.OPENCLAW_HOME) return resolve(process.env.OPENCLAW_HOME);
  return join(homedir(), '.openclaw');
}

function resolveConfigPath(home: string): string {
  if (process.env.OPENCLAW_CONFIG) return resolve(process.env.OPENCLAW_CONFIG);
  return join(home, 'openclaw.json');
}

function getPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

function readJson(p: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeJson(p: string, data: unknown): void {
  writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

function patchAllowList(
  parent: Record<string, unknown>,
  key: string,
  label: string,
  mode: 'add' | 'remove',
): string | undefined {
  if (!Array.isArray(parent[key]) || (parent[key] as unknown[]).length === 0)
    return undefined;
  const list = parent[key] as string[];
  if (mode === 'add') {
    if (!list.includes(PLUGIN_ID)) {
      list.push(PLUGIN_ID);
      return 'Added "' + PLUGIN_ID + '" to ' + label;
    }
  } else {
    const filtered = list.filter((id) => id !== PLUGIN_ID);
    if (filtered.length !== list.length) {
      parent[key] = filtered;
      return 'Removed "' + PLUGIN_ID + '" from ' + label;
    }
  }
  return undefined;
}

export function patchConfig(
  config: Record<string, unknown>,
  mode: 'add' | 'remove',
): string[] {
  const messages: string[] = [];
  if (!config.plugins || typeof config.plugins !== 'object')
    config.plugins = {};
  const plugins = config.plugins as Record<string, unknown>;

  const pluginAllow = patchAllowList(plugins, 'allow', 'plugins.allow', mode);
  if (pluginAllow) messages.push(pluginAllow);

  if (!plugins.entries || typeof plugins.entries !== 'object')
    plugins.entries = {};
  const entries = plugins.entries as Record<string, unknown>;
  if (mode === 'add') {
    if (!entries[PLUGIN_ID]) {
      entries[PLUGIN_ID] = { enabled: true };
      messages.push('Added "' + PLUGIN_ID + '" to plugins.entries');
    }
  } else if (PLUGIN_ID in entries) {
    Reflect.deleteProperty(entries, PLUGIN_ID);
    messages.push('Removed "' + PLUGIN_ID + '" from plugins.entries');
  }

  const tools = (config.tools ?? {}) as Record<string, unknown>;
  const toolAllow = patchAllowList(tools, 'allow', 'tools.allow', mode);
  if (toolAllow) messages.push(toolAllow);

  return messages;
}

function install(): void {
  const home = resolveOpenClawHome();
  const configPath = resolveConfigPath(home);
  const extDir = join(home, 'extensions', PLUGIN_ID);
  const pkgRoot = getPackageRoot();

  console.log('OpenClaw home:  ' + home);
  console.log('Config:         ' + configPath);
  console.log('Extensions dir: ' + extDir);
  console.log('Package root:   ' + pkgRoot);
  console.log();

  if (!existsSync(home)) {
    console.error('Error: OpenClaw home not found at ' + home);
    process.exit(1);
  }
  if (!existsSync(configPath)) {
    console.error('Error: OpenClaw config not found at ' + configPath);
    process.exit(1);
  }

  console.log('Copying plugin to extensions directory...');
  if (existsSync(extDir)) rmSync(extDir, { recursive: true, force: true });
  mkdirSync(extDir, { recursive: true });

  for (const file of ['dist', 'openclaw.plugin.json', 'package.json']) {
    const src = join(pkgRoot, file);
    const dest = join(extDir, file);
    if (existsSync(src)) {
      cpSync(src, dest, { recursive: true });
      console.log('  \u2713 ' + file);
    }
  }

  const nodeModulesSrc = join(pkgRoot, 'node_modules');
  if (existsSync(nodeModulesSrc)) {
    cpSync(nodeModulesSrc, join(extDir, 'node_modules'), { recursive: true });
    console.log('  \u2713 node_modules');
  }

  console.log();
  console.log('Patching OpenClaw config...');
  const config = readJson(configPath);
  if (!config) {
    console.error('Error: Could not parse ' + configPath);
    process.exit(1);
  }
  for (const msg of patchConfig(config, 'add')) console.log('  \u2713 ' + msg);
  writeJson(configPath, config);

  console.log();
  console.log('\u2705 Plugin installed successfully.');
  console.log('   Restart the OpenClaw gateway to load the plugin.');
}

function uninstall(): void {
  const home = resolveOpenClawHome();
  const configPath = resolveConfigPath(home);
  const extDir = join(home, 'extensions', PLUGIN_ID);

  console.log('OpenClaw home:  ' + home);
  console.log('Config:         ' + configPath);
  console.log('Extensions dir: ' + extDir);
  console.log();

  if (existsSync(extDir)) {
    rmSync(extDir, { recursive: true, force: true });
    console.log('\u2713 Removed ' + extDir);
  } else console.log('  (extensions directory not found, skipping)');

  if (existsSync(configPath)) {
    console.log('Patching OpenClaw config...');
    const config = readJson(configPath);
    if (config) {
      for (const msg of patchConfig(config, 'remove'))
        console.log('  \u2713 ' + msg);
      writeJson(configPath, config);
    }
  }

  // Clean up TOOLS.md server section
  cleanupToolsMd(home, configPath);

  console.log();
  console.log('\u2705 Plugin uninstalled successfully.');
  console.log('   Restart the OpenClaw gateway to complete removal.');
}

function resolveWorkspaceDir(home: string, configPath: string): string | null {
  const config = readJson(configPath);
  if (!config) return null;
  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const workspace = defaults?.workspace as string | undefined;
  if (workspace) return resolve(workspace.replace(/^~/, homedir()));
  return join(home, 'workspace');
}

function cleanupToolsMd(home: string, configPath: string): void {
  const workspaceDir = resolveWorkspaceDir(home, configPath);
  if (!workspaceDir) return;
  const toolsPath = join(workspaceDir, 'TOOLS.md');
  if (!existsSync(toolsPath)) return;
  let content = readFileSync(toolsPath, 'utf8');
  const serverRe = /^## Server\n[\s\S]*?(?=\n## |\n# |$(?![\s\S]))/m;
  if (!serverRe.test(content)) return;
  content = content.replace(serverRe, '').replace(/\n{3,}/g, '\n\n');
  content = content.trim() + '\n';
  writeFileSync(toolsPath, content);
  console.log('\u2713 Cleaned up TOOLS.md (removed Server section)');
}

const command = process.argv[2];
switch (command) {
  case 'install':
    install();
    break;
  case 'uninstall':
    uninstall();
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
    if (
      command &&
      command !== 'help' &&
      command !== '--help' &&
      command !== '-h'
    ) {
      console.error('\nUnknown command: ' + command);
      process.exit(1);
    }
    break;
}
