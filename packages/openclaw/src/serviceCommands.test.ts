/**
 * Tests for service and plugin lifecycle commands.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('./openclawPaths.js', () => ({
  resolveOpenClawHome: () => '/mock/.openclaw',
  resolveConfigPath: () => '/mock/.openclaw/openclaw.json',
}));

vi.mock('./pluginRemove.js', () => ({
  removePlugin: vi.fn(() => ['Removed extension']),
}));

import { execSync } from 'node:child_process';

import { removePlugin } from './pluginRemove.js';
import {
  createPluginCommands,
  createServiceCommands,
} from './serviceCommands.js';

describe('createServiceCommands', () => {
  it('stop() calls nssm stop JeevesServer', async () => {
    vi.mocked(execSync).mockReturnValueOnce('');

    await createServiceCommands().stop();

    expect(execSync).toHaveBeenCalledWith('nssm stop JeevesServer', {
      encoding: 'utf8',
      timeout: 15000,
    });
  });

  it('status() returns running=true when NSSM reports SERVICE_RUNNING', async () => {
    vi.mocked(execSync).mockReturnValueOnce(
      'SERVICE_NAME: JeevesServer\nSTATE              : 4  SERVICE_RUNNING\n',
    );

    const status = await createServiceCommands().status();
    expect(status).toEqual({ running: true });
  });

  it('status() returns running=false when NSSM reports SERVICE_STOPPED', async () => {
    vi.mocked(execSync).mockReturnValueOnce(
      'SERVICE_NAME: JeevesServer\nSTATE              : 1  SERVICE_STOPPED\n',
    );

    const status = await createServiceCommands().status();
    expect(status).toEqual({ running: false });
  });

  it('status() returns running=false when NSSM throws', async () => {
    vi.mocked(execSync).mockImplementationOnce(() => {
      throw new Error('nssm not found');
    });

    const status = await createServiceCommands().status();
    expect(status).toEqual({ running: false });
  });

  it('uninstall() stops then removes the service', async () => {
    vi.mocked(execSync).mockReturnValue('');

    await createServiceCommands().uninstall();

    expect(execSync).toHaveBeenCalledWith('nssm stop JeevesServer', {
      encoding: 'utf8',
      timeout: 15000,
    });
    expect(execSync).toHaveBeenCalledWith('nssm remove JeevesServer confirm', {
      encoding: 'utf8',
      timeout: 15000,
    });
  });

  it('uninstall() proceeds with remove even if stop throws', async () => {
    vi.mocked(execSync)
      .mockImplementationOnce(() => {
        throw new Error('service not running');
      })
      .mockReturnValueOnce('');

    await createServiceCommands().uninstall();

    expect(execSync).toHaveBeenCalledWith('nssm remove JeevesServer confirm', {
      encoding: 'utf8',
      timeout: 15000,
    });
  });
});

describe('createPluginCommands', () => {
  it('uninstall() delegates to removePlugin with resolved paths', async () => {
    await createPluginCommands().uninstall();

    expect(removePlugin).toHaveBeenCalledWith(
      '/mock/.openclaw',
      '/mock/.openclaw/openclaw.json',
    );
  });
});
