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
  {};
