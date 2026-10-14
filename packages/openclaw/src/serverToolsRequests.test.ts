import type * as Jeeves from '@karmaniverous/jeeves';
import type {
  PluginApi,
  ToolDescriptor,
  ToolResult,
} from '@karmaniverous/jeeves';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock('@karmaniverous/jeeves', async (importOriginal) => {
  const actual = await importOriginal<typeof Jeeves>();
  return { ...actual, fetchJson: fetchJsonMock };
});

const { EXPORT_TIMEOUT_MS, registerServerTools } =
  await import('./serverTools.js');

const BASE_URL = 'http://127.0.0.1:1934';

/** Register the server_* tools against a stub API and return them by name. */
function collectTools(): Map<string, ToolDescriptor> {
  const tools = new Map<string, ToolDescriptor>();
  const api: PluginApi = {
    registerTool: (tool: ToolDescriptor) => {
      tools.set(tool.name, tool);
    },
    logger: { warn: vi.fn() },
  };
  registerServerTools(api, BASE_URL, () => undefined);
  return tools;
}

/** Run a registered tool by name. */
function run(
  name: string,
  params: Record<string, unknown>,
  response: unknown = {},
): Promise<ToolResult> {
  fetchJsonMock.mockResolvedValueOnce(response);
  const tool = collectTools().get(name);
  if (!tool) throw new Error(`tool not registered: ${name}`);
  return tool.execute('call-1', params);
}

afterEach(() => {
  fetchJsonMock.mockReset();
});

describe('server_export timeout', () => {
  it('passes a 10-minute timeoutMs to fetchJson', async () => {
    await run('server_export', { path: 'j/docs/a.md', format: 'pdf' });

    expect(EXPORT_TIMEOUT_MS).toBe(600_000);
    expect(fetchJsonMock).toHaveBeenCalledTimes(1);
    const [url, , options] = fetchJsonMock.mock.calls[0] as [
      string,
      unknown,
      unknown,
    ];
    expect(url).toContain('/api/export/j/docs/a.md?format=pdf');
    expect(options).toEqual({ timeoutMs: EXPORT_TIMEOUT_MS });
  });

  it('leaves other tools on the core default timeout', async () => {
    await run('server_browse', { path: 'j/docs' });

    const [, , options] = fetchJsonMock.mock.calls[0] as [
      string,
      unknown,
      unknown,
    ];
    expect(options).toBeUndefined();
  });
});
