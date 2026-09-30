import { isDeepStrictEqual } from "node:util";

import type {
  WebhookObservation
} from "./types.js";
import type { ReplayResult } from "./replay.js";

export interface ComparisonResult {
  passed: boolean;
  statusMatches: boolean;
  bodyMatches: boolean;
}

export function compareReplayResult(
  baseline: WebhookObservation,
  actual: ReplayResult
): ComparisonResult {
  const statusMatches = baseline.status === actual.status;
  const bodyMatches = isDeepStrictEqual(baseline.body, actual.body);

  return {
    passed: statusMatches && bodyMatches,
    statusMatches,
    bodyMatches
  };
}

export function compareAssertionState(
  expected: unknown,
  actual: unknown
): boolean {
  return isDeepStrictEqual(
    expected,
    actual
  );
}
