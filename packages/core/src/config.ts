import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ReplayConfig {
  webhookSecretEnv: string;
}

export interface AssertionConfig {
  command: string;
  args?: string[];
  timeoutMs?: number;
}

export interface DuplicateReplayConfig {
  sequential: number;
}

export interface SpokeConfig {
  endpoint: string;
  eventsDir: string;
  timeoutMs: number;
  replay?: ReplayConfig;
  assertion?: AssertionConfig;
  duplicates?: DuplicateReplayConfig;
}

export const DEFAULT_SPOKE_CONFIG: SpokeConfig = {
  endpoint: "http://localhost:3000/webhook",
  eventsDir: ".spoke/events",
  timeoutMs: 5000
};

export async function loadConfig(
  projectRoot: string
): Promise<SpokeConfig> {
  const configPath = join(
    projectRoot,
    ".spoke",
    "config.json"
  );

  const content = await readFile(
    configPath,
    "utf8"
  );

  const parsed: unknown = JSON.parse(content);

  if (!isSpokeConfig(parsed)) {
    throw new Error(
      `Invalid Spoke config: ${configPath}`
    );
  }

  return parsed;
}

function isSpokeConfig(
  value: unknown
): value is SpokeConfig {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.endpoint !== "string" ||
    value.endpoint.length === 0
  ) {
    return false;
  }

  if (
    typeof value.eventsDir !== "string" ||
    value.eventsDir.length === 0
  ) {
    return false;
  }

  if (
    typeof value.timeoutMs !== "number" ||
    !Number.isFinite(value.timeoutMs) ||
    value.timeoutMs <= 0
  ) {
    return false;
  }

  if (value.replay !== undefined) {
    if (!isRecord(value.replay)) {
      return false;
    }

    if (
      typeof value.replay.webhookSecretEnv !== "string" ||
      value.replay.webhookSecretEnv.length === 0
    ) {
      return false;
    }
  }

  if (value.assertion !== undefined) {
    if (!isRecord(value.assertion)) {
      return false;
    }

    if (
      typeof value.assertion.command !== "string" ||
      value.assertion.command.length === 0
    ) {
      return false;
    }

    if (
      value.assertion.args !== undefined &&
      (
        !Array.isArray(value.assertion.args) ||
        !value.assertion.args.every(
          (argument) => typeof argument === "string"
        )
      )
    ) {
      return false;
    }

    if (
      value.assertion.timeoutMs !== undefined &&
      (
        typeof value.assertion.timeoutMs !== "number" ||
        !Number.isFinite(value.assertion.timeoutMs) ||
        value.assertion.timeoutMs <= 0
      )
    ) {
      return false;
    }
  }

  if (value.duplicates !== undefined) {
    if (!isRecord(value.duplicates)) {
      return false;
    }

    if (
      typeof value.duplicates.sequential !== "number" ||
      !Number.isInteger(
        value.duplicates.sequential
      ) ||
      value.duplicates.sequential <= 0
    ) {
      return false;
    }
  }

  return true;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" &&
    value !== null;
}
