/**
 * Server state management (key rotation tracking, etc.)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { withFileLock } from '@karmaniverous/jeeves';

import { getConfig } from '../config/index.js';
import type { ServerState } from '../config/types.js';

/**
 * Load state from file
 */
function loadState(): ServerState {
  const { stateFile } = getConfig();
  try {
    if (fs.existsSync(stateFile)) {
      const content = fs.readFileSync(stateFile, 'utf8');
      return JSON.parse(content) as ServerState;
    }
  } catch {
    // Ignore errors, return empty state
  }
  return {};
}

/**
 * Save state to file
 */
function saveState(state: ServerState): void {
  const { stateFile } = getConfig();
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Atomically write JSON to a file (write to tmp, then rename).
 */
function atomicWriteJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  const tmpFile = path.join(
    dir,
    `.tmp-${crypto.randomBytes(8).toString('hex')}.json`,
  );
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpFile, filePath);
}

/**
 * Persist an insider's seed and keyCreatedAt into the config JSON file.
 * Preserves all existing content — only updates the specific insider entry.
 * Uses a file lock to prevent concurrent first-logins from losing updates.
 */
async function writeInsiderSeedToConfig(
  email: string,
  seed: string,
  createdAt: string,
): Promise<void> {
  const { configPath } = getConfig();
  const normalizedEmail = email.toLowerCase();

  await withFileLock(configPath, () => {
    let rawConfig: Record<string, unknown>;
    try {
      rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<
        string,
        unknown
      >;
    } catch (err) {
      console.warn('Failed to read config for insider seed update:', err);
      return;
    }

    const insiders = (rawConfig.insiders ?? {}) as Record<
      string,
      Record<string, unknown>
    >;

    // Find the matching insider key (case-insensitive)
    const matchingKey = Object.keys(insiders).find(
      (k) => k.toLowerCase() === normalizedEmail,
    );
    if (!matchingKey) return; // Insider not in config — skip

    insiders[matchingKey] = {
      ...insiders[matchingKey],
      seed,
      keyCreatedAt: createdAt,
    };
    rawConfig.insiders = insiders;

    try {
      atomicWriteJson(configPath, rawConfig);
    } catch (err) {
      console.warn('Failed to write config for insider seed update:', err);
    }
  });
}

/**
 * Set key rotation timestamp
 */
export function setKeyRotationTimestamp(timestamp: string): void {
  const state = loadState();
  state.keyRotatedAt = timestamp;
  saveState(state);
}

/**
 * Set an insider's auto-generated key.
 * Writes to config.json (primary) and state.json (backward compat).
 */
export async function setInsiderKey(
  email: string,
  seed: string,
  createdAt: string,
): Promise<void> {
  // Write to config.json (primary storage)
  await writeInsiderSeedToConfig(email, seed, createdAt);

  // Write to state.json (backward compat during transition)
  const state = loadState();
  if (!state.insiderKeys) state.insiderKeys = {};
  state.insiderKeys[email.toLowerCase()] = { seed, createdAt };
  saveState(state);
}
