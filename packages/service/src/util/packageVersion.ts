/**
 * Resolve the service package version using core's getPackageVersion().
 */

import { getPackageVersion } from '@karmaniverous/jeeves';

/** The package version of the jeeves-server service package. */
export const packageVersion: string = getPackageVersion(import.meta.url);
