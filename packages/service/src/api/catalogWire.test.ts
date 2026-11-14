// @vitest-environment node
/**
 * `SERVER_CATALOG` against the wire baseline: every recorded success (2xx JSON) reply of a catalog route parses with its entry's response schema and serialises back byte for byte. With strict response validation the service sends the parsed value, so this proves no field is dropped, retyped or reordered. Reads `wire-baseline.json`; never edits it.
 */

import { readFileSync } from 'node:fs';

import { SERVER_CATALOG } from '@karmaniverous/jeeves-server-core';
import { describe, expect, it } from 'vitest';

import { WIRE_SCENARIOS } from '../test/wire/scenarios.js';
import type { WireRecord, WireScenario } from '../test/wire/wireTypes.js';

const baseline = JSON.parse(
  readFileSync(
    new URL('../test/wire/wire-baseline.json', import.meta.url),
    'utf8',
  ),
) as Record<string, WireRecord>;

type Entry = (typeof SERVER_CATALOG.entries)[number];

/**
 * A route pattern as a regular expression over the URL path.
 *
 * @param path - Fastify path (`:param`, `*`).
 * @returns The anchored pattern.
 */
const pathPattern = (path: string) =>
  new RegExp(
    '^' +
      path
        .split('*')
        .map((part) =>
          part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:\w+/g, '[^/]+'),
        )
        .join('.*') +
      '$',
  );

const ROUTES = SERVER_CATALOG.entries.map((entry) => ({
  entry,
  pattern: pathPattern(entry.path),
}));

/**
 * The catalog entry a scenario calls, if any.
 *
 * @param scenario - Wire scenario.
 * @returns Its entry, or undefined for browser and removed routes.
 */
function entryOf(scenario: WireScenario): Entry | undefined {
  const path = scenario.url.split('?')[0];
  return ROUTES.find(
    (r) => r.entry.method === scenario.method && r.pattern.test(path),
  )?.entry;
}

/** Valid stand-ins for top-level fields the recorder redacted. */
const REDACTED_STAND_INS: Record<string, unknown> = {
  content: '# Page\n',
  html: '<h1>Page</h1>',
  headings: [],
};

/**
 * Required fields 3.16.0 adds to a recorded success (the wire departures
 * list them): appended to the recorded body before it is parsed.
 */
const ADDED_FIELDS: Readonly<Partial<Record<string, Record<string, unknown>>>> =
  {
    rotateKey: { invalidates: ['insiderKey', 'outsiderLinks'] },
  };

/**
 * A recorded body with its redacted fields replaced by valid stand-ins and
 * the fields 3.16.0 adds appended.
 *
 * @param scenario - Wire scenario.
 * @param body - Recorded body text.
 * @returns The JSON text a schema must reproduce.
 */
function comparable(scenario: WireScenario, body: string): string {
  const added = ADDED_FIELDS[entryOf(scenario)?.name ?? ''];
  if (!scenario.redact && !added) return body;
  const value = JSON.parse(body) as Record<string, unknown>;
  for (const field of scenario.redact ?? [])
    if (field in REDACTED_STAND_INS) value[field] = REDACTED_STAND_INS[field];
  return JSON.stringify({ ...value, ...added });
}

const SUCCESSES = WIRE_SCENARIOS.flatMap((scenario) => {
  const record = baseline[scenario.name];
  const entry = entryOf(scenario);
  return entry &&
    !('contentType' in entry) &&
    record.status < 300 &&
    record.body &&
    (record.headers['content-type'] ?? '').includes('json')
    ? [{ name: scenario.name, entry, body: comparable(scenario, record.body) }]
    : [];
});

describe('catalog response schemas against the wire baseline', () => {
  it.for(SUCCESSES)(
    '$name: $entry.name reproduces the recorded body',
    ({ entry, body }) => {
      const parsed = entry.response.parse(JSON.parse(body));
      expect(JSON.stringify(parsed)).toBe(body);
    },
  );

  it('covers every JSON entry the baseline records a success for', () => {
    const covered = new Set(SUCCESSES.map((s) => s.entry.name));
    const uncovered = SERVER_CATALOG.entries
      .filter((e) => !('contentType' in e) && !covered.has(e.name))
      .map((e) => e.name);
    // No success recorded: watcher and runner are unreachable in the wire
    // app, and no scenario signs an outsider share by URL key alone.
    expect(uncovered).toEqual([
      'search',
      'searchFacets',
      'runnerGet',
      'runnerPost',
      'runnerPatch',
      'runnerPut',
      'runnerDelete',
    ]);
  });

  it('maps scenarios to entries by method and path only', () => {
    const scenario = (method: WireScenario['method'], url: string) =>
      entryOf({ name: 'x', method, url })?.name;
    expect(scenario('GET', '/api/file/r/a.md?raw=1')).toBe('fileContent');
    expect(scenario('PUT', '/api/file/r/a.md')).toBe('fileWrite');
    expect(scenario('GET', '/api/export-cache/r')).toBeUndefined();
    expect(scenario('POST', '/rotate-key')).toBeUndefined();
  });
});
