import type { PluginApi } from '@karmaniverous/jeeves';
import { describe, expect, it } from 'vitest';

import { registerOAuthTools } from './oauthTools.js';

interface ToolDef {
  name: string;
  parameters: {
    properties: Record<string, unknown>;
    required?: string[];
  };
}

function collectTools(): ToolDef[] {
  const tools: ToolDef[] = [];
  const mockApi = {
    registerTool: (def: ToolDef, _opts: unknown) => {
      tools.push(def);
    },
  } as unknown as PluginApi;

  registerOAuthTools(mockApi, 'http://localhost:1934', undefined, undefined);
  return tools;
}

describe('registerOAuthTools', () => {
  const tools = collectTools();

  it('registers all 3 tools with correct names', () => {
    const names = tools.map((t) => t.name);
    expect(names).toContain('oauth_authorize');
    expect(names).toContain('oauth_status');
    expect(names).toContain('oauth_token');
    expect(names).toHaveLength(3);
  });

  it('oauth_authorize includes provider, account, clientId, clientSecret parameters', () => {
    const tool = tools.find((t) => t.name === 'oauth_authorize')!;
    const props = Object.keys(tool.parameters.properties);
    expect(props).toContain('provider');
    expect(props).toContain('account');
    expect(props).toContain('clientId');
    expect(props).toContain('clientSecret');
    expect(tool.parameters.required).toEqual(
      expect.arrayContaining([
        'provider',
        'account',
        'clientId',
        'clientSecret',
      ]),
    );
  });

  it('oauth_status includes provider and account parameters', () => {
    const tool = tools.find((t) => t.name === 'oauth_status')!;
    const props = Object.keys(tool.parameters.properties);
    expect(props).toContain('provider');
    expect(props).toContain('account');
    expect(tool.parameters.required).toEqual(
      expect.arrayContaining(['provider', 'account']),
    );
  });

  it('oauth_token includes provider and account parameters', () => {
    const tool = tools.find((t) => t.name === 'oauth_token')!;
    const props = Object.keys(tool.parameters.properties);
    expect(props).toContain('provider');
    expect(props).toContain('account');
    expect(tool.parameters.required).toEqual(
      expect.arrayContaining(['provider', 'account']),
    );
  });
});
