import { readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(
    new URL("../package.json", import.meta.url),
    "utf8"
  )
) as {
  version: string;
};

export const CORE_VERSION =
  packageJson.version;

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
  ReplayResult,
  ReplayRequestOptions
} from "./replay.js";

export {
  compareReplayResult
} from "./compare.js";

export type {
  ComparisonResult
} from "./compare.js";

export {
  DEFAULT_SPOKE_CONFIG,
  loadConfig
} from "./config.js";

export type {
  SpokeConfig
} from "./config.js";

export {
  listFixturePaths
} from "./discovery.js";