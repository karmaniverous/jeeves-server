/**
 * Service and plugin lifecycle commands for the JeevesComponent interface.
 *
 * Wraps NSSM service management (JeevesServer) and plugin uninstall
 * via the existing CLI patchConfig() logic.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import type {
  PluginCommands,
  ServiceCommands,
  ServiceStatus,
} from '@karmaniverous/jeeves';

import { patchConfig } from './configPatch.js';

const NSSM_SERVICE_NAME = 'JeevesServer';
const PLUGIN_ID = 'jeeves-server-openclaw';

/**
 * Run an NSSM command and return stdout.
 *
 * @param args - NSSM command arguments.
 * @returns stdout string.
 */
function nssmExec(args: string): string {
  return execSync(`nssm ${args}`, { encoding: 'utf8', timeout: 15_000 });
}

/**
 * Resolve the OpenClaw home directory.
 */
function resolveOpenClawHome(): string {
  if (process.env.OPENCLAW_CONFIG)
    return dirname(resolve(process.env.OPENCLAW_CONFIG));
  if (process.env.OPENCLAW_HOME) return resolve(process.env.OPENCLAW_HOME);
  return join(homedir(), '.openclaw');
}

/**
 * Resolve the OpenClaw config file path.
 */
function resolveConfigPath(home: string): string {
  if (process.env.OPENCLAW_CONFIG) return resolve(process.env.OPENCLAW_CONFIG);
  return join(home, 'openclaw.json');
}

/**
 * Create service lifecycle commands for the JeevesServer NSSM service.
 *
 * @returns ServiceCommands implementation.
 */
export function createServiceCommands(): ServiceCommands {
  return {
    stop(): Promise<void> {
      nssmExec(`stop ${NSSM_SERVICE_NAME}`);
      return Promise.resolve();
    },

    uninstall(): Promise<void> {
      try {
        nssmExec(`stop ${NSSM_SERVICE_NAME}`);
      } catch {
        // Service may not be running
      }
      nssmExec(`remove ${NSSM_SERVICE_NAME} confirm`);
      return Promise.resolve();
    },

    status(): Promise<ServiceStatus> {
      try {
        const output = nssmExec(`status ${NSSM_SERVICE_NAME}`);
        const running = output.includes('SERVICE_RUNNING');
        return Promise.resolve({ running });
      } catch {
        return Promise.resolve({ running: false });
      }
    },
  };
}

/**
 * Create plugin lifecycle commands for the OpenClaw plugin.
 *
 * @returns PluginCommands implementation.
 */
export function createPluginCommands(): PluginCommands {
  return {
    uninstall(): Promise<void> {
      const home = resolveOpenClawHome();
      const configPath = resolveConfigPath(home);
      const extDir = join(home, 'extensions', PLUGIN_ID);

      // Remove extension directory
      if (existsSync(extDir)) {
        rmSync(extDir, { recursive: true, force: true });
      }

      // Patch config to remove plugin
      if (existsSync(configPath)) {
        const raw = readFileSync(configPath, 'utf8');
        const config = JSON.parse(raw) as Record<string, unknown>;
        patchConfig(config, 'remove');
        writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
      }

      return Promise.resolve();
    },
  };
}
