import {
  replayFixture,
  runAssertionCommand
} from "@spoke-labs/core";

import type {
  SpokeConfig,
  WebhookFixture,
  WebhookObservation
} from "@spoke-labs/core";

import {
  createReplayRequestOptions
} from "./replay.js";

export async function captureObservation(
  fixture: WebhookFixture,
  config: SpokeConfig,
  projectRoot: string
): Promise<WebhookObservation> {
  const replayOptions =
    createReplayRequestOptions(
      fixture,
      config
    );

  const actual =
    await replayFixture(
      fixture,
      config.endpoint,
      config.timeoutMs,
      replayOptions
    );

  if (config.assertion === undefined) {
    return actual;
  }

  return {
    ...actual,
    state:
      await runAssertionCommand(
        config.assertion,
        projectRoot,
        fixture
      )
  };
}
