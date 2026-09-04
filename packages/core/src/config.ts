import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface SpokeConfig {
  endpoint: string;
  eventsDir: string;
  timeoutMs: number;
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
    typeof value.timeoutMs != "number" ||
    !Number.isFinite(value.timeoutMs) ||
    value.timeoutMs <= 0
  ) {
    return false;
  }

  return true;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}