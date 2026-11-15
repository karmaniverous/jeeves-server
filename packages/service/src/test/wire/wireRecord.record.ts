// @vitest-environment node
/**
 * Records every wire scenario's reply to the JSON file named by `WIRE_RECORD`. Not part of the test suite (the `.record.ts` suffix is outside vitest's include): `scripts/capture-wire.ts` copies it into a worktree at the branch base and runs it there to produce `wire-baseline.json`; run in this tree (`WIRE_RECORD=<file> npx vitest run --config vitest.wire-record.config.ts`) it records what the current code sends. Writes one file.
 *
 * @packageDocumentation
 */

import { writeFileSync } from 'node:fs';

import { afterAll, beforeAll, expect, it } from 'vitest';

import { WIRE_SCENARIOS } from './scenarios.js';
import { startWireApp, type WireApp } from './wireApp.js';
import { runScenario } from './wireRun.js';
import type { WireRecord } from './wireTypes.js';

let wire: WireApp;

beforeAll(async () => {
  wire = await startWireApp();
});

afterAll(async () => {
  await wire.close();
});

it('records every scenario', async () => {
  const out = process.env.WIRE_RECORD;
  expect(out, 'set WIRE_RECORD to the output path').toBeTruthy();
  const records: Record<string, WireRecord> = {};
  for (const scenario of WIRE_SCENARIOS) {
    records[scenario.name] = await runScenario(wire, scenario);
  }
  writeFileSync(out as string, JSON.stringify(records, null, 2) + '\n');
}, 300_000);
