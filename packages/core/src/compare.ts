import { isDeepStrictEqual } from "node:util";

import type { WebhookBaseline } from "./types.js";
import type { ReplayResult } from "./replay.js";

export interface ComparisonResult {
  passed: boolean;
  statusMatches: boolean;
  bodyMatches: boolean;
}

export function compareReplayResult(
  baseline: WebhookBaseline,
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
