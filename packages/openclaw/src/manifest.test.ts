import { readFileSync } from 'node:fs';

import { validateSkillFrontmatter } from '@karmaniverous/jeeves';
import { describe, expect, it } from 'vitest';

type ConfigProperty = { type: string; default?: unknown };

const MAX_DESCRIPTION_CHARS = 160;

const readJson = (relative: string): unknown =>
  JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf-8'));

const manifest = readJson('../openclaw.plugin.json') as {
  configSchema: {
    additionalProperties: boolean;
    required?: string[];
    properties: Partial<Record<string, ConfigProperty>>;
  };
  skills: string[];
};

describe('openclaw.plugin.json', () => {
  it('declares configRoot and apiUrl, with no configRoot default', () => {
    const { properties, required, additionalProperties } =
      manifest.configSchema;

    expect(additionalProperties).toBe(false);
    expect(properties['configRoot']?.type).toBe('string');
    expect(properties['configRoot']).not.toHaveProperty('default');
    expect(properties['apiUrl']?.type).toBe('string');
    // Registration must succeed before `jeeves install` writes config.
    expect(required ?? []).not.toContain('configRoot');
  });

  it('ships skills whose SKILL.md has name and description frontmatter', () => {
    expect(manifest.skills).toEqual(['dist/skills/jeeves-server']);
    const skill = readFileSync(
      new URL('../skills/jeeves-server/SKILL.md', import.meta.url),
      'utf-8',
    );

    expect(validateSkillFrontmatter(skill)).toMatchObject({
      name: 'jeeves-server',
      description: expect.stringContaining('jeeves-server') as unknown,
    });
  });

  /*
   * OpenClaw cuts every catalog description to a compact form once the full
   * skills catalog exceeds `skills.limits.maxSkillsPromptChars`, so the
   * description stays short: trigger words, no filler.
   */
  it(`keeps the skill description within ${String(MAX_DESCRIPTION_CHARS)} characters`, () => {
    const skill = readFileSync(
      new URL('../skills/jeeves-server/SKILL.md', import.meta.url),
      'utf-8',
    );

    expect(
      validateSkillFrontmatter(skill).description.length,
    ).toBeLessThanOrEqual(MAX_DESCRIPTION_CHARS);
  });
});

describe('package.json', () => {
  it('ships no plugin-specific installer CLI', () => {
    expect(readJson('../package.json')).not.toHaveProperty('bin');
  });
});
