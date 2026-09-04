import {
  readFile,
  writeFile
} from "node:fs/promises";

import type { WebhookFixture } from "./types.js";

export async function loadFixture(path: string): Promise<WebhookFixture> {
  const content = await readFile(path, "utf8");
  const parsed: unknown = JSON.parse(content);

  if (!isWebhookFixture(parsed)) {
    throw new Error(`Invalid webhook fixture: ${path}`);
  }

  return parsed;
}

export async function saveFixture(
  path: string,
  fixture: WebhookFixture
): Promise<void> {
  const content = JSON.stringify(fixture, null, 2);

  await writeFile(path, `${content}\n`, "utf8");
}

function isWebhookFixture(value: unknown): value is WebhookFixture {
  if (!isRecord(value)) {
    return false;
  }

  const event = value.event;
  const baseline = value.baseline;

  if (!isRecord(event)) {
    return false;
  }

  if (typeof event.id !== "string") {
    return false;
  }

  if (typeof event.provider !== "string") {
    return false;
  }

  if (typeof event.type !== "string") {
    return false;
  }

  if (!("payload" in event)) {
    return false;
  }

  if (!isRecord(baseline)) {
    return false;
  }

  if (typeof baseline.status !== "number") {
    return false;
  }

  if (!("body" in baseline)) {
    return false;
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}