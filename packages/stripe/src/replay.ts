import type {
  ReplayRequestOptions,
  WebhookFixture
} from "@spoke-labs/core";

import {
  createStripeSignatureHeader
} from "./signature.js";

export function createStripeReplayRequest(
  fixture: WebhookFixture,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000)
): ReplayRequestOptions {
  if (fixture.event.provider !== "stripe") {
    throw new Error(
      "Cannot create Stripe replay request for a non-Stripe fixture."
    );
  }

  const body =
    JSON.stringify(fixture.event.payload);

  const signature =
    createStripeSignatureHeader(
      body,
      secret,
      timestamp
    );

  return {
    body,
    headers: {
      "stripe-signature": signature
    }
  };
}