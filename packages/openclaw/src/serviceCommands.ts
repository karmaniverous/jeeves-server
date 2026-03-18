/**
 * Service and plugin lifecycle commands for the JeevesComponent interface.
 *
 * Wraps NSSM service management (JeevesServer) and plugin uninstall
 * via shared removal logic.
 */

import { execSync } from 'node:child_process';

import type {
  PluginCommands,
  ServiceCommands,
  ServiceStatus,
} from '@karmaniverous/jeeves';

import { resolveConfigPath, resolveOpenClawHome } from './openclawPaths.js';
import { removePlugin } from './pluginRemove.js';

const NSSM_SERVICE_NAME = 'JeevesServer';

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
 * Create service lifecycle commands for the JeevesServer NSSM service.
 *
 * @returns ServiceCommands implementation.
 */
export function createServiceCommands(): ServiceCommands {
  return {
    stop(): Promise<void> {
      try {
        nssmExec(`stop ${NSSM_SERVICE_NAME}`);
        return Promise.resolve();
      } catch (err: unknown) {
        return Promise.reject(
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    },

    uninstall(): Promise<void> {
      try {
        nssmExec(`stop ${NSSM_SERVICE_NAME}`);
      } catch {
        // Service may not be running
      }
      try {
        nssmExec(`remove ${NSSM_SERVICE_NAME} confirm`);
        return Promise.resolve();
      } catch (err: unknown) {
        return Promise.reject(
          err instanceof Error ? err : new Error(String(err)),
        );
      }
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
      removePlugin(home, configPath);
      return Promise.resolve();
    },
  };
}
