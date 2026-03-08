import { describe, expect, it } from 'vitest';

import { patchConfig } from './cli.js';

describe('patchConfig', () => {
  describe('add mode', () => {
    it('adds plugin to plugins.entries', () => {
      const config: Record<string, unknown> = {};
      const msgs = patchConfig(config, 'add');
      const plugins = config.plugins as Record<string, unknown>;
      const entries = plugins.entries as Record<string, unknown>;
      expect(entries['jeeves-server-openclaw']).toEqual({ enabled: true });
      expect(msgs.some((m) => m.includes('plugins.entries'))).toBe(true);
    });

    it('adds to plugins.allow when populated', () => {
      const config: Record<string, unknown> = {
        plugins: { allow: ['other-plugin'], entries: {} },
      };
      patchConfig(config, 'add');
      const plugins = config.plugins as Record<string, unknown>;
      expect(plugins.allow).toContain('jeeves-server-openclaw');
    });

    it('skips plugins.allow when empty', () => {
      const config: Record<string, unknown> = {
        plugins: { allow: [], entries: {} },
      };
      const msgs = patchConfig(config, 'add');
      expect(msgs.every((m) => !m.includes('plugins.allow'))).toBe(true);
    });

    it('adds to tools.allow when populated', () => {
      const config: Record<string, unknown> = {
        tools: { allow: ['some-tool'] },
      };
      patchConfig(config, 'add');
      const tools = config.tools as Record<string, unknown>;
      expect(tools.allow).toContain('jeeves-server-openclaw');
    });

    it('does not duplicate if already present', () => {
      const config: Record<string, unknown> = {
        plugins: {
          allow: ['jeeves-server-openclaw'],
          entries: { 'jeeves-server-openclaw': { enabled: true } },
        },
      };
      const msgs = patchConfig(config, 'add');
      expect(msgs).toHaveLength(0);
    });
  });

  describe('remove mode', () => {
    it('removes plugin from plugins.entries', () => {
      const config: Record<string, unknown> = {
        plugins: {
          entries: { 'jeeves-server-openclaw': { enabled: true } },
        },
      };
      const msgs = patchConfig(config, 'remove');
      const plugins = config.plugins as Record<string, unknown>;
      const entries = plugins.entries as Record<string, unknown>;
      expect(entries['jeeves-server-openclaw']).toBeUndefined();
      expect(msgs.some((m) => m.includes('plugins.entries'))).toBe(true);
    });

    it('removes from plugins.allow', () => {
      const config: Record<string, unknown> = {
        plugins: {
          allow: ['other', 'jeeves-server-openclaw'],
          entries: {},
        },
      };
      patchConfig(config, 'remove');
      const plugins = config.plugins as Record<string, unknown>;
      expect(plugins.allow).not.toContain('jeeves-server-openclaw');
      expect(plugins.allow).toContain('other');
    });

    it('no-ops if plugin not present', () => {
      const config: Record<string, unknown> = {
        plugins: { entries: {} },
      };
      const msgs = patchConfig(config, 'remove');
      expect(msgs).toHaveLength(0);
    });
  });
});
