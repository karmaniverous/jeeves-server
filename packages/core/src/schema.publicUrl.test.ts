import { describe, expect, it } from 'vitest';

import { jeevesConfigSchema } from './schema.js';

const base = {
  chromePath: '/usr/bin/chromium',
  keys: { primary: 'a'.repeat(64) },
};
const email = {
  auth: {
    modes: ['keys', 'email'],
    sessionSecret: 's'.repeat(32),
    email: { smtpUrl: 'smtp://localhost:25', fromAddress: 'a@example.com' },
  },
};
const google = {
  auth: {
    modes: ['keys', 'google'],
    sessionSecret: 's'.repeat(32),
    google: { clientId: 'id', clientSecret: 'secret' },
  },
};
const oauth = {
  auth: { modes: ['keys'] },
  oauth: { credentialDir: '/srv/credentials' },
};

/** Messages of the issues reported at `publicUrl`. */
function publicUrlIssues(config: Record<string, unknown>): string[] {
  const result = jeevesConfigSchema.safeParse({ ...base, ...config });
  if (result.success) return [];
  return result.error.issues
    .filter((i) => i.path.join('.') === 'publicUrl')
    .map((i) => i.message);
}

describe('jeevesConfigSchema: publicUrl required for login flows', () => {
  it.each([
    ['email login', email],
    ['Google login', google],
    ['OAuth (oauth)', oauth],
  ])('rejects %s without publicUrl', (flow, config) => {
    const issues = publicUrlIssues(config);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/^publicUrl is required/u);
    expect(issues[0]).toContain(flow);
    expect(issues[0]).toContain('trustProxyHeaders');
  });

  it('names every configured flow in one issue', () => {
    const issues = publicUrlIssues({ ...email, oauth: oauth.oauth });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('email login, OAuth (oauth)');
  });

  it.each([email, google, oauth])(
    'accepts a login flow with publicUrl',
    (c) => {
      expect(
        publicUrlIssues({ ...c, publicUrl: 'https://docs.example.com' }),
      ).toEqual([]);
    },
  );

  it.each([email, google, oauth])(
    'accepts a login flow with trustProxyHeaders: true',
    (c) => {
      expect(publicUrlIssues({ ...c, trustProxyHeaders: true })).toEqual([]);
    },
  );

  it('still rejects with trustProxyHeaders: false', () => {
    expect(
      publicUrlIssues({ ...email, trustProxyHeaders: false }),
    ).toHaveLength(1);
  });

  it('does not require publicUrl for key-only configs', () => {
    expect(
      jeevesConfigSchema.safeParse({ ...base, auth: { modes: ['keys'] } })
        .success,
    ).toBe(true);
  });
});
