/**
 * Start-up Node.js version check for the CLI entry points: on a Node older than {@link MIN_NODE_VERSION} it writes an error to stderr and exits with code 1.
 *
 * The floor matches `engines.node` in every package of this repo. Core's
 * `checkNodeVersion` only enforces Node 22, so the service checks its own.
 *
 * @packageDocumentation
 */

/**
 * Minimum supported Node.js version: the floor for every Jeeves component
 * (the built-in SQLite in Node 24.16.0-24.18.0 left WAL files
 * un-checkpointed).
 */
export const MIN_NODE_VERSION = '24.22.2';

/**
 * Split a `major.minor.patch` version into numbers. A prerelease or build
 * suffix on the patch (`1-rc.1`) is ignored; a missing or non-numeric part
 * counts as 0.
 *
 * @param version - Version string, without a leading `v`.
 * @returns `[major, minor, patch]`.
 */
const parseVersion = (version: string): [number, number, number] => {
  const [major = '0', minor = '0', patch = '0'] = version.split('.');
  const toNumber = (part: string): number => Number.parseInt(part, 10) || 0;
  return [toNumber(major), toNumber(minor), toNumber(patch)];
};

/**
 * Whether a Node.js version is at or above a floor.
 *
 * @param version - Version to test, e.g. `process.versions.node`.
 * @param floor - Minimum version; defaults to {@link MIN_NODE_VERSION}.
 * @returns `true` when `version` is at least `floor`.
 */
export const meetsNodeFloor = (
  version: string,
  floor: string = MIN_NODE_VERSION,
): boolean => {
  const [major, minor, patch] = parseVersion(version);
  const [floorMajor, floorMinor, floorPatch] = parseVersion(floor);
  if (major !== floorMajor) return major > floorMajor;
  if (minor !== floorMinor) return minor > floorMinor;
  return patch >= floorPatch;
};

/**
 * Exit the process with code 1 and an error on stderr when the running
 * Node.js is older than {@link MIN_NODE_VERSION}.
 *
 * @param version - Version to check; defaults to the running Node.js.
 */
export const checkNodeVersion = (
  version: string = process.versions.node,
): void => {
  if (meetsNodeFloor(version)) return;
  console.error(
    `Error: jeeves-server requires Node.js >= ${MIN_NODE_VERSION}. Current: ${version}`,
  );
  process.exit(1);
};
