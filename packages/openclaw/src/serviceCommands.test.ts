import { describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';

import { createServiceCommands } from './serviceCommands.js';

describe('createServiceCommands', () => {
  it('status() returns running=true when NSSM reports SERVICE_RUNNING', async () => {
    vi.mocked(execSync).mockReturnValueOnce(
      'SERVICE_NAME: JeevesServer\nSTATE              : 4  SERVICE_RUNNING\n',
    );

    const status = await createServiceCommands().status();
    expect(status).toEqual({ running: true });
  });

  it('status() returns running=false when NSSM status throws', async () => {
    vi.mocked(execSync).mockImplementationOnce(() => {
      throw new Error('nssm not found');
    });

    const status = await createServiceCommands().status();
    expect(status).toEqual({ running: false });
  });

  it('stop() calls nssm stop JeevesServer', async () => {
    vi.mocked(execSync).mockReturnValueOnce('');

    await createServiceCommands().stop();

    expect(execSync).toHaveBeenCalledWith('nssm stop JeevesServer', {
      encoding: 'utf8',
      timeout: 15000,
    });
  });
});
