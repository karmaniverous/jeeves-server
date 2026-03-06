/**
 * Config resolution — transforms raw validated config into runtime types.
 *
 * Handles: key resolution, insider merging with state, PlantUML server defaults,
 * scope normalization, internal key derivation.
 */

import fs from 'node:fs';

import { computeInsiderKey } from '../util/crypto.js';
import type {
  NormalizedScopes,
  ResolvedInsider,
  ResolvedKey,
  ServerState,
} from './types.js';

/**
 * Normalize any scopes format to \{ allow, deny \}.
 * - undefined/null → null (unrestricted)
 * - string → \{ allow: [string], deny: [] \}
 * - string[] → \{ allow: string[], deny: [] \}
 * - \{ allow?, deny? \} → \{ allow: allow ?? ['/**'], deny: deny ?? [] \}
 */
export function normalizeScopes(raw: unknown): NormalizedScopes | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') return { allow: [raw], deny: [] };
  if (Array.isArray(raw)) return { allow: raw as string[], deny: [] };
  if (typeof raw === 'object') {
    const obj = raw as { allow?: string[]; deny?: string[] };
    return {
      allow: obj.allow ?? ['/**'],
      deny: obj.deny ?? [],
    };
  }
  return null;
}

/**
 * Resolve raw key entries to ResolvedKey[].
 */
export function resolveKeys(
  keys: Record<string, string | { key: string; scopes?: unknown }>,
): ResolvedKey[] {
  return Object.entries(keys).map(([name, entry]) => {
    if (typeof entry === 'string') {
      return { name, seed: entry, scopes: null };
    }
    return { name, seed: entry.key, scopes: normalizeScopes(entry.scopes) };
  });
}

/**
 * Resolve insider entries by merging config (identity + scopes) with state (keys).
 */
export function resolveInsiders(
  insiders: Record<string, { scopes?: unknown }>,
  stateFile: string,
): ResolvedInsider[] {
  let serverState: ServerState = {};
  try {
    if (fs.existsSync(stateFile)) {
      serverState = JSON.parse(
        fs.readFileSync(stateFile, 'utf8'),
      ) as ServerState;
    }
  } catch {
    /* empty state */
  }

  return Object.entries(insiders).map(([rawEmail, entry]) => {
    const email = rawEmail.toLowerCase();
    const scopes = normalizeScopes(entry.scopes);
    const stateKey = serverState.insiderKeys?.[email];
    return {
      email,
      seed: stateKey?.seed ?? '',
      scopes,
      keyCreatedAt: stateKey?.createdAt ?? null,
    };
  });
}

/**
 * Resolve PlantUML config with community server fallback.
 */
export function resolvePlantuml(config?: {
  jarPath?: string;
  javaPath?: string;
  servers?: string[];
}): { jarPath?: string; javaPath?: string; servers: string[] } {
  const COMMUNITY = 'https://www.plantuml.com/plantuml';
  const servers = config?.servers ? [...config.servers] : [];
  if (!servers.includes(COMMUNITY)) servers.push(COMMUNITY);
  return { jarPath: config?.jarPath, javaPath: config?.javaPath, servers };
}

/**
 * Derive the internal insider key from resolved keys.
 */
export function deriveInternalKey(resolvedKeys: ResolvedKey[]): string | null {
  const internalKey = resolvedKeys.find((k) => k.name === '_internal');
  return internalKey ? computeInsiderKey(internalKey.seed) : null;
}
