import type { WebhookFixture } from "./types.js";

export interface ReplayResult {
  status: number;
  body: unknown;
}

export async function replayFixture(
  fixture: WebhookFixture,
  url: string
): Promise<ReplayResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(fixture.event.payload)
  });

  const body: unknown = await response.json();

  return {
    status: response.status,
    body
  };
}