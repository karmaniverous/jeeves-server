/**
 * Network bind address resolution.
 *
 * Returns the appropriate default bind address for the current platform.
 * Server needs to bind to all interfaces (0.0.0.0) to support external
 * access by insiders, share links, etc.
 */

/**
 * Get the default bind address for the server.
 *
 * Returns '0.0.0.0' to bind to all interfaces, which is required for
 * external access patterns (insider auth, share links, proxied requests).
 */
export function getBindAddress(): string {
  return '0.0.0.0';
}
