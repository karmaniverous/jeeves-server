/**
 * Scope resolution: normalising inline scopes and resolving named scope
 * references against the top-level scopes map.
 */

import { isScopeName } from './schema.js';
import type { NormalizedScopes } from './types.js';

/**
 * Normalize any scopes format to \{ allow, deny \}.
 * - undefined/null → null (unrestricted)
 * - string → \{ allow: [string], deny: [] \}
 * - string[] → \{ allow: string[], deny: [] \}
 * - \{ allow?, deny? \} → \{ allow: allow ?? ['/**'], deny: deny ?? [] \}
 */
export function normalizeScopes(raw: unknown): NormalizedScopes | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string')
    return { allow: [raw], deny: [], explicitAllow: [], explicitDeny: [] };
  if (Array.isArray(raw))
    return {
      allow: raw as string[],
      deny: [],
      explicitAllow: [],
      explicitDeny: [],
    };
  if (typeof raw === 'object') {
    const obj = raw as { allow?: string[]; deny?: string[] };
    return {
      allow: obj.allow ?? ['/**'],
      deny: obj.deny ?? [],
      explicitAllow: [],
      explicitDeny: [],
    };
  }
  return null;
}

/**
 * Resolve named scope references (string or string[]) against the top-level scopes map,
 * optionally merging explicit allow/deny overrides.
 *
 * Returns null if no scopes are provided.
 * Falls back to normalizeScopes() for legacy inline scope formats.
 */
export function resolveNamedScopes(
  named: Record<string, { allow?: string[]; deny?: string[] } | undefined>,
  rawScopes: unknown,
  overrides?: { allow?: string[]; deny?: string[] },
): NormalizedScopes | null {
  if (rawScopes === undefined || rawScopes === null) {
    if (overrides?.allow?.length || overrides?.deny?.length) {
      return {
        allow: overrides.allow ?? ['/**'],
        deny: overrides.deny ?? [],
        explicitAllow: overrides.allow ?? [],
        explicitDeny: overrides.deny ?? [],
      };
    }
    return null;
  }

  // Determine whether rawScopes is a named reference (identifier(s))
  const refs =
    typeof rawScopes === 'string'
      ? isScopeName(rawScopes)
        ? [rawScopes]
        : null
      : Array.isArray(rawScopes) &&
          rawScopes.every((v) => typeof v === 'string')
        ? rawScopes.filter((v) => isScopeName(v))
        : null;

  if (refs && refs.length > 0) {
    const allow: string[] = [];
    const deny: string[] = [];

    for (const ref of refs) {
      const scope = named[ref];
      if (!scope) continue; // schema should have validated
      if (scope.allow) allow.push(...scope.allow);
      if (scope.deny) deny.push(...scope.deny);
    }

    if (overrides?.allow) allow.push(...overrides.allow);
    if (overrides?.deny) deny.push(...overrides.deny);

    return {
      allow: allow.length > 0 ? allow : ['/**'],
      deny,
      explicitAllow: overrides?.allow ?? [],
      explicitDeny: overrides?.deny ?? [],
    };
  }

  // Legacy inline scopes
  const normalized = normalizeScopes(rawScopes);
  if (!normalized) return null;
  if (overrides?.allow) normalized.allow.push(...overrides.allow);
  if (overrides?.deny) normalized.deny.push(...overrides.deny);
  normalized.explicitAllow = overrides?.allow ?? [];
  normalized.explicitDeny = overrides?.deny ?? [];
  return normalized;
}
