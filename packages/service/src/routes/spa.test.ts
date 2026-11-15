import { describe, expect, it } from 'vitest';

import { isSpaRequest } from './spa.js';

describe('isSpaRequest', () => {
  it.each(['/browse', '/browse/a/.hidden', '/runner', '/runner/jobs/x'])(
    'claims GET %s for the SPA',
    (url) => {
      expect(isSpaRequest({ method: 'GET', url })).toBe(true);
    },
  );

  it.each([
    ['GET', '/api/browse'],
    ['GET', '/no-such-route'],
    ['POST', '/browse/x'],
    ['HEAD', '/runner'],
  ])('leaves %s %s to SERVER_NOT_FOUND', (method, url) => {
    expect(isSpaRequest({ method, url })).toBe(false);
  });
});
