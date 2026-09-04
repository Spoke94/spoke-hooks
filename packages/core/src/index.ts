export const CORE_VERSION = "0.0.1";

export type {
  WebhookEvent,
  WebhookBaseline,
  WebhookFixture
} from "./types.js";

export {
  loadFixture,
  saveFixture
} from "./fixture.js";

export {
  replayFixture,
  ReplayRequestError
} from "./replay.js";

export type {
  ReplayResult
} from "./replay.js";

export {
  compareReplayResult
} from "./compare.js";

export type {
  ComparisonResult
} from "./compare.js";

export {
  loadConfig
} from "./config.js";

export type {
  SpokeConfig
} from "./config.js";

export {
  listFixturePaths
} from "./discovery.js";