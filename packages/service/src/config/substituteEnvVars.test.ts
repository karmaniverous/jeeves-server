import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { substituteEnvVars } from './substituteEnvVars.js';

describe('substituteEnvVars', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('replaces a single env var in a string', () => {
    process.env['TEST_VAR'] = 'hello';
    expect(substituteEnvVars('${TEST_VAR}')).toBe('hello');
  });

  it('replaces multiple env vars in a string', () => {
    process.env['HOST'] = 'localhost';
    process.env['PORT'] = '3456';
    expect(substituteEnvVars('http://${HOST}:${PORT}')).toBe(
      'http://localhost:3456',
    );
  });

  it('leaves unresolvable expressions untouched', () => {
    expect(substituteEnvVars('${MISSING_VAR}')).toBe('${MISSING_VAR}');
  });

  it('handles non-string primitives unchanged', () => {
    expect(substituteEnvVars(42)).toBe(42);
    expect(substituteEnvVars(true)).toBe(true);
    expect(substituteEnvVars(null)).toBe(null);
  });

  it('deep-walks objects', () => {
    process.env['SECRET'] = 'abc123';
    const input = { nested: { key: '${SECRET}' }, plain: 'no-sub' };
    expect(substituteEnvVars(input)).toEqual({
      nested: { key: 'abc123' },
      plain: 'no-sub',
    });
  });

  it('deep-walks arrays', () => {
    process.env['ITEM'] = 'resolved';
    expect(substituteEnvVars(['${ITEM}', 'literal'])).toEqual([
      'resolved',
      'literal',
    ]);
  });

  it('handles mixed nested structures', () => {
    process.env['A'] = 'alpha';
    const input = { list: [{ val: '${A}' }, '${A}'], num: 5 };
    expect(substituteEnvVars(input)).toEqual({
      list: [{ val: 'alpha' }, 'alpha'],
      num: 5,
    });
  });
});
