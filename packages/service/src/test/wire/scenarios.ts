/**
 * Every wire scenario: success and error cases for every route the service registers, under every kind of credential (`scenariosService`, `scenariosContent`, `scenariosWrite`, `scenariosFiles`, `scenariosSharing`, `scenariosIntegrations`). Run by `wireRun`; no assertions.
 *
 * @packageDocumentation
 */

import { SCENARIOS_CONTENT } from './scenariosContent.js';
import { SCENARIOS_FILES } from './scenariosFiles.js';
import { SCENARIOS_INTEGRATIONS } from './scenariosIntegrations.js';
import { SCENARIOS_SERVICE } from './scenariosService.js';
import { SCENARIOS_SHARING } from './scenariosSharing.js';
import { SCENARIOS_WRITE } from './scenariosWrite.js';
import type { WireScenario } from './wireTypes.js';

/** All scenarios, in recording order. */
export const WIRE_SCENARIOS: readonly WireScenario[] = [
  ...SCENARIOS_SERVICE,
  ...SCENARIOS_CONTENT,
  ...SCENARIOS_WRITE,
  ...SCENARIOS_FILES,
  ...SCENARIOS_SHARING,
  ...SCENARIOS_INTEGRATIONS,
];
