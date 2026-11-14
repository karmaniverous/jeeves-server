/**
 * The closed list of approved wire departures from the branch-base baseline (`wire-baseline.json`): each departing scenario, what the base sent, and the spec decision that allows the change, with the error code the new body must carry. Pure data, split by route group.
 *
 * @packageDocumentation
 */

import type { WireDeparture } from './departuresCommon.js';
import { DEPARTURES_CONTENT } from './departuresContent.js';
import { DEPARTURES_EXPORT } from './departuresExport.js';
import { DEPARTURES_INTEGRATIONS } from './departuresIntegrations.js';
import { DEPARTURES_SERVICE } from './departuresService.js';
import { DEPARTURES_SHARING } from './departuresSharing.js';
import { DEPARTURES_WRITE } from './departuresWrite.js';

export type { WireDeparture } from './departuresCommon.js';

/** Approved departures by scenario name. */
export const WIRE_DEPARTURES: Readonly<Partial<Record<string, WireDeparture>>> =
  {
    ...DEPARTURES_SERVICE,
    ...DEPARTURES_CONTENT,
    ...DEPARTURES_WRITE,
    ...DEPARTURES_EXPORT,
    ...DEPARTURES_SHARING,
    ...DEPARTURES_INTEGRATIONS,
  };
