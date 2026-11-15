import { describe, expect, it } from 'vitest';

import { authSchema, getScopeRefs } from './configAuthSchema.js';

describe('authSchema: accessContact (#304)', () => {
  it('is optional', () => {
    expect(authSchema.parse({ modes: ['keys'] }).accessContact).toBeUndefined();
  });

  it('keeps free text, trimmed', () => {
    expect(
      authSchema.parse({
        modes: ['google'],
        accessContact: '  Jane Doe <jane@example.com> ',
      }).accessContact,
    ).toBe('Jane Doe <jane@example.com>');
  });

  it.each(['', '   '])('rejects a blank contact %j', (accessContact) => {
    expect(
      authSchema.safeParse({ modes: ['google'], accessContact }).success,
    ).toBe(false);
  });
});

describe('getScopeRefs', () => {
  it.each([
    ['restricted', ['restricted']],
    ['/**', []],
    [
      ['no-vc', '/j/**', 'team_1'],
      ['no-vc', 'team_1'],
    ],
    [['no-vc', 3], []],
    [[], []],
    [{ allow: ['/a'] }, []],
    [undefined, []],
  ])('%j refers to named scopes %j', (scopes, refs) => {
    expect(getScopeRefs(scopes)).toEqual(refs);
  });
});
