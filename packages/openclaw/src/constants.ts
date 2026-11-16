/**
 * Shared constants for the jeeves-server OpenClaw plugin.
 */

/** Plugin identifier used in OpenClaw config and extension paths. */
export const PLUGIN_ID = 'jeeves-server-openclaw';

/**
 * Description of every tool's `path` parameter: tools take browse paths, not
 * filesystem paths (#320).
 */
export const BROWSE_PATH_DESCRIPTION =
  'Browse path (use server_resolve_path to convert a filesystem path)';
