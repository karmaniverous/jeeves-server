import { describe, expect, it } from 'vitest';

import { packageVersion } from './packageVersion.js';

describe('packageVersion', () => {
  it('returns a valid semver version string', () => {
    expect(packageVersion).toMatch(/^\d+\.\d+\.\d+/);
  });
});
