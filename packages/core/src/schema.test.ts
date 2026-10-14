import { describe, expect, it } from 'vitest';

import { jeevesConfigSchema } from './schema.js';

const minimal = {
  chromePath: '/usr/bin/chromium',
  auth: { modes: ['keys'] },
  keys: { primary: 'a'.repeat(64) },
};

describe('jeevesConfigSchema trustProxyHeaders', () => {
  it('defaults to false', () => {
    expect(jeevesConfigSchema.parse(minimal).trustProxyHeaders).toBe(false);
  });

  it('accepts true', () => {
    expect(
      jeevesConfigSchema.parse({ ...minimal, trustProxyHeaders: true })
        .trustProxyHeaders,
    ).toBe(true);
  });

  it('rejects non-boolean values', () => {
    expect(
      jeevesConfigSchema.safeParse({ ...minimal, trustProxyHeaders: 'yes' })
        .success,
    ).toBe(false);
  });
});
