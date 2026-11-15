// @vitest-environment node
/**
 * Wire compatibility: every scenario's reply from the current code must match
 * what the branch base sent (`wire-baseline.json`, recorded by
 * `npm run wire:capture`), unless `departures.ts` lists it with the decision
 * that allows the change. Never edit the baseline to make this pass.
 */

import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { WIRE_DEPARTURES } from '../test/wire/departures.js';
import { WIRE_SCENARIOS } from '../test/wire/scenarios.js';
import { startWireApp, type WireApp } from '../test/wire/wireApp.js';
import { runScenario } from '../test/wire/wireRun.js';
import type { WireRecord } from '../test/wire/wireTypes.js';

const baseline = JSON.parse(
  readFileSync(
    new URL('../test/wire/wire-baseline.json', import.meta.url),
    'utf8',
  ),
) as Record<string, WireRecord>;

const unchanged = WIRE_SCENARIOS.filter((s) => !WIRE_DEPARTURES[s.name]);
const departing = WIRE_SCENARIOS.flatMap((s) => {
  const departure = WIRE_DEPARTURES[s.name];
  return departure ? [{ scenario: s, departure }] : [];
});

let wire: WireApp;

beforeAll(async () => {
  wire = await startWireApp();
});

afterAll(async () => {
  await wire.close();
});

describe('wire baseline', () => {
  it('records every scenario, and only scenarios, once', () => {
    const names = WIRE_SCENARIOS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    expect(Object.keys(baseline).sort()).toEqual([...names].sort());
    expect(departing.map((d) => d.scenario.name).sort()).toEqual(
      Object.keys(WIRE_DEPARTURES).sort(),
    );
  });

  it.for(unchanged)('$name', async (scenario) => {
    expect(await runScenario(wire, scenario)).toEqual(baseline[scenario.name]);
  });

  it.for(departing)(
    '$scenario.name departs as approved',
    async ({ scenario, departure }) => {
      const record = await runScenario(wire, scenario);
      expect(record).not.toEqual(baseline[scenario.name]);
      expect(record.status).toBe(departure.status);
      const code = record.body?.startsWith('{')
        ? (JSON.parse(record.body) as { code?: unknown }).code
        : undefined;
      expect(code).toBe(departure.code);
    },
  );
});
