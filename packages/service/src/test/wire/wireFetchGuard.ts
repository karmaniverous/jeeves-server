/**
 * Keeps the wire app off the network: while installed, `fetch` to any host other than the loopback address fails as an unreachable host does (`TypeError: fetch failed`). Dependency URLs point at {@link CLOSED_PORT_URL}, so they fail the same way for real. Mutates `globalThis.fetch` until restored.
 *
 * @packageDocumentation
 */

/**
 * A loopback URL nothing answers: port 9 (discard) is on the fetch
 * standard's blocked-port list, so `fetch` fails at once (`fetch failed`,
 * cause `bad port`) without opening a connection.
 */
export const CLOSED_PORT_URL = 'http://127.0.0.1:9';

/**
 * The URL a `fetch` call addresses.
 *
 * @param input - First `fetch` argument.
 * @returns The URL.
 */
function targetOf(input: Parameters<typeof fetch>[0]): URL {
  if (typeof input === 'string') return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

/**
 * Install the guard.
 *
 * @returns A function restoring the original `fetch`.
 */
export function guardFetch(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (input, init) =>
    targetOf(input).hostname === '127.0.0.1'
      ? original(input, init)
      : Promise.reject(new TypeError('fetch failed'));
  return () => {
    globalThis.fetch = original;
  };
}
