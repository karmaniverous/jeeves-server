import { patchConfig } from '@karmaniverous/jeeves';
import { describe, expect, it } from 'vitest';

const PLUGIN_ID = 'jeeves-server-openclaw';

describe('patchConfig', () => {
  describe('add mode', () => {
    it('adds plugin to plugins.entries', () => {
      const config: Record<string, unknown> = {};
      const msgs = patchConfig(config, PLUGIN_ID, 'add');
      const plugins = config.plugins as Record<string, unknown>;
      const entries = plugins.entries as Record<string, unknown>;
      expect(entries[PLUGIN_ID]).toEqual({ enabled: true });
      expect(msgs.some((m) => m.includes('plugins.entries'))).toBe(true);
    });

    it('is idempotent for plugins.entries', () => {
      const config: Record<string, unknown> = {
        plugins: {
          entries: { [PLUGIN_ID]: { enabled: true } },
        },
      };
      patchConfig(config, PLUGIN_ID, 'add');
      const plugins = config.plugins as Record<string, unknown>;
      const entries = plugins.entries as Record<string, unknown>;
      // Entry should still be present, not duplicated
      expect(entries[PLUGIN_ID]).toEqual({ enabled: true });
    });
  });

  describe('remove mode', () => {
    it('removes plugin from plugins.entries', () => {
      const config: Record<string, unknown> = {
        plugins: {
          entries: { [PLUGIN_ID]: { enabled: true } },
        },
      };
      const msgs = patchConfig(config, PLUGIN_ID, 'remove');
      const plugins = config.plugins as Record<string, unknown>;
      const entries = plugins.entries as Record<string, unknown>;
      expect(entries[PLUGIN_ID]).toBeUndefined();
      expect(msgs.some((m) => m.includes('plugins.entries'))).toBe(true);
    });

    it('no-ops if plugin not present', () => {
      const config: Record<string, unknown> = {
        plugins: { entries: {} },
      };
      const msgs = patchConfig(config, PLUGIN_ID, 'remove');
      expect(msgs).toHaveLength(0);
    });
  });
});
