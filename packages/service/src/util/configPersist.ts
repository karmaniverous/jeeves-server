/**
 * Persist insider seed data into the config JSON file.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';

import { withFileLock } from '@karmaniverous/jeeves';

import { getConfig } from '../config/index.js';
import { writeFileAtomic } from './atomicWrite.js';

/**
 * Persist an insider's seed and keyCreatedAt into the config JSON file.
 * Preserves all existing content — only updates the specific insider entry.
 * Uses a file lock to prevent concurrent first-logins from losing updates.
 */
export async function writeInsiderSeedToConfig(
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
      writeFileAtomic(configPath, JSON.stringify(rawConfig, null, 2));
    } catch (err) {
      console.warn('Failed to write config for insider seed update:', err);
    }
  });
}
