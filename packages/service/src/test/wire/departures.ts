/**
 * The closed list of approved wire departures from the branch-base baseline (`wire-baseline.json`): each departing scenario, what the base sent, and the spec decision that allows the change, with the error code the new body must carry. Empty until a task changes a reply. Pure data.
 *
 * @packageDocumentation
 */

/** One approved departure. */
export interface WireDeparture {
  /** What the branch base sent, and why it changes. */
  before: string;
  /** The spec decision or design section that allows it. */
  allowedBy: string;
  /** HTTP status of the new reply. */
  status: number;
  /** The `code` of the new standard error body (error replies only). */
  code?: string;
}

/** Approved departures by scenario name. */
export const WIRE_DEPARTURES: Readonly<Partial<Record<string, WireDeparture>>> =
  {
    // jeeves-owned handler (`createConfigQueryHandler`): jeeves 0.10.0 sends
    // Fastify's standard error body for an invalid JSONPath.
    'config invalid jsonpath': {
      before:
        '400 {"error":"Unclosed ( at character 3"} from @karmaniverous/jeeves 0.7.0',
      allowedBy: 'Decision 4 (all packages on @karmaniverous/jeeves ^0.11.0)',
      status: 400,
      code: 'JEEVES_CONFIG_QUERY_INVALID',
    },
    // jeeves-owned handler (`createConfigApplyHandler`): jeeves 0.10.0 folds
    // the Zod issues into `message` of Fastify's standard error body.
    'configApply invalid config': {
      before:
        '400 {"error":"Config validation failed","issues":[{"expected":"number","code":"invalid_type","path":["port"],"message":"Invalid input: expected number, received string"}]} from @karmaniverous/jeeves 0.7.0',
      allowedBy: 'Decision 4 (all packages on @karmaniverous/jeeves ^0.11.0)',
      status: 400,
      code: 'JEEVES_CONFIG_INVALID',
    },
  };
