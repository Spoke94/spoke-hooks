import type { WebhookFixture } from "./types.js";

export interface ReplayRequestOptions {
  body?: string;
  headers?: Record<string, string>;
}

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
  timeoutMs = 5000,
  options: ReplayRequestOptions = {}
): Promise<ReplayResult> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const requestBody =
    options.body ??
    JSON.stringify(fixture.event.payload);

  const requestHeaders = {
    "content-type": "application/json",
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal
    });
    const responseText = await response.text();

    let responseBody: unknown = null;

    if (responseText.length > 0) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }
    }

    return {
      status: response.status,
      body: responseBody
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