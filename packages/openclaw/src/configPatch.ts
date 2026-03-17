/**
 * OpenClaw config patching utilities.
 *
 * @remarks
 * Shared by both the `npx ... install|uninstall` CLI and by in-process
 * plugin commands.
 */

const PLUGIN_ID = 'jeeves-server-openclaw';

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

  if (!config.tools || typeof config.tools !== 'object') config.tools = {};
  const tools = config.tools as Record<string, unknown>;
  const toolAllow = patchAllowList(tools, 'allow', 'tools.allow', mode);
  if (toolAllow) messages.push(toolAllow);

  return messages;
}
