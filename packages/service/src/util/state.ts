/**
 * Server state management (key rotation tracking, etc.)
 */

import fs from 'node:fs';

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
 * Set key rotation timestamp
 */
export function setKeyRotationTimestamp(timestamp: string): void {
  const state = loadState();
  state.keyRotatedAt = timestamp;
  saveState(state);
}

/**
 * Set an insider's auto-generated key in state
 */
export function setInsiderKey(
  email: string,
  seed: string,
  createdAt: string,
): void {
  const state = loadState();
  if (!state.insiderKeys) state.insiderKeys = {};
  state.insiderKeys[email.toLowerCase()] = { seed, createdAt };
  saveState(state);
}
