import {
  ReplayRequestError
} from "@spoke-labs/core";

import type {
  ReplayRequestOptions,
  SpokeConfig,
  WebhookFixture
} from "@spoke-labs/core";

import {
  createStripeReplayRequest
} from "@spoke-labs/stripe";

export function createReplayRequestOptions(
  fixture: WebhookFixture,
  config: SpokeConfig,
  environment: NodeJS.ProcessEnv = process.env
): ReplayRequestOptions {
  if (config.replay === undefined) {
    return {};
  }

  const environmentName =
    config.replay.webhookSecretEnv;

  const secret =
    environment[environmentName];

  if (
    secret === undefined ||
    secret.length === 0
  ) {
    throw new ReplayRequestError(
      `Webhook signing is configured, but environment variable ${environmentName} is not set.`
    );
  }

  if (fixture.event.provider === "stripe") {
    return createStripeReplayRequest(
      fixture,
      secret
    );
  }

  throw new ReplayRequestError(
    `Webhook signing is not supported for provider: ${fixture.event.provider}`
  );
}