import type { WebhookFixture } from "./types.js";

export interface ReplayResult {
  status: number;
  body: unknown;
}

export class ReplayRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayRequestError";
  }
}

export async function replayFixture(
  fixture: WebhookFixture,
  url: string,
  timeoutMs = 5000
): Promise<ReplayResult> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(fixture.event.payload),
      signal: controller.signal
    });
    const responseText = await response.text();

    let body: unknown = null;

    if (responseText.length > 0) {
      try {
        body = JSON.parse(responseText);
      } catch {
        body = responseText;
      }
    }

    return {
      status: response.status,
      body
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ReplayRequestError(
        `Webhook request timed out after ${timeoutMs} ms: ${url}`
      );
    }

    throw new ReplayRequestError(
      `Could not connect to webhook endpoint: ${url}`
    );
  } finally {
    clearTimeout(timeout);
  }
}