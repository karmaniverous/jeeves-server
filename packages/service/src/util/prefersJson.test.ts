import { describe, expect, it } from 'vitest';

import { prefersJson } from './prefersJson.js';

describe('prefersJson', () => {
  it.each([
    ['application/json'],
    ['application/json, text/plain, */*'],
    ['text/html;q=0.5, application/json'],
    ['application/json, */*;q=0.1'],
    ['APPLICATION/JSON'],
    ['text/*, application/json'],
    [['text/plain', 'application/json']],
  ])('is true for %j', (accept) => {
    expect(prefersJson(accept)).toBe(true);
  });

  it.each([
    [undefined],
    [''],
    ['*/*'],
    ['text/html'],
    ['text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'],
    ['text/html, application/json'],
    ['application/json;q=0, */*'],
    ['application/json;q=0.5, */*'],
    ['application/json;q=0.5, text/*'],
    ['application/json;q=abc'],
  ])('is false for %j', (accept) => {
    expect(prefersJson(accept)).toBe(false);
  });
});
