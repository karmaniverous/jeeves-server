import { describe, expect, it } from 'vitest';

import { serverEndpoints } from './endpoints.js';

describe('serverEndpoints catalog', () => {
  const entries = Object.entries(serverEndpoints);

  it('has at least 20 endpoints', () => {
    expect(entries.length).toBeGreaterThanOrEqual(20);
  });

  it('lists the 3.15.0 routes with their access rules', () => {
    expect(serverEndpoints.health).toMatchObject({
      method: 'GET',
      path: '/health',
      unauthenticated: true,
    });
    expect(serverEndpoints['resolve-path']).toMatchObject({
      method: 'GET',
      path: '/api/resolve-path',
      insiderOnly: true,
    });
    expect(serverEndpoints.events).toMatchObject({
      path: '/api/events',
      insiderOnly: true,
    });
    expect(serverEndpoints['export-cache-clear'].insiderOnly).toBe(true);
  });

  it('never marks an endpoint both insider-only and unauthenticated', () => {
    for (const [key, entry] of entries) {
      expect(
        entry.insiderOnly && entry.unauthenticated,
        `${key}: both insiderOnly and unauthenticated`,
      ).toBeFalsy();
    }
  });

  it('every entry has a valid method, non-empty path starting with /, and non-empty description', () => {
    for (const [key, entry] of entries) {
      expect(
        ['GET', 'POST', 'PUT', 'DELETE'],
        `${key}: invalid method ${entry.method}`,
      ).toContain(entry.method);
      expect(entry.path.length, `${key}: empty path`).toBeGreaterThan(0);
      expect(entry.path[0], `${key}: path does not start with /`).toBe('/');
      expect(
        entry.description.length,
        `${key}: empty description`,
      ).toBeGreaterThan(0);
    }
  });
});
