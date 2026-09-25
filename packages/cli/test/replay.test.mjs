import test from "node:test";
import assert from "node:assert/strict";

import {
  createReplayRequestOptions
} from "../dist/replay.js";

const fixture = {
  event: {
    id: "evt_test_001",
    provider: "stripe",
    type: "payment_intent.succeeded",
    payload: {
      id: "evt_test_001",
      type: "payment_intent.succeeded"
    }
  },
  baseline: null
};

test(
  "keeps replay unsigned when signing is not configured",
  () => {
    const config = {
      endpoint:
        "http://localhost:3000/webhook",
      eventsDir:
        ".spoke/events",
      timeoutMs: 5000
    };

    const options =
      createReplayRequestOptions(
        fixture,
        config,
        {}
      );

    assert.deepEqual(
      options,
      {}
    );
  }
);

test(
  "creates a signed Stripe replay request from the configured environment variable",
  () => {
    const config = {
      endpoint:
        "http://localhost:3000/webhook",
      eventsDir:
        ".spoke/events",
      timeoutMs: 5000,
      replay: {
        webhookSecretEnv:
          "STRIPE_WEBHOOK_SECRET"
      }
    };

    const options =
      createReplayRequestOptions(
        fixture,
        config,
        {
          STRIPE_WEBHOOK_SECRET:
            "whsec_test_secret"
        }
      );

    assert.equal(
      options.body,
      JSON.stringify(
        fixture.event.payload
      )
    );

    assert.match(
      options.headers?.["stripe-signature"] ?? "",
      /^t=\d+,v1=[0-9a-f]{64}$/
    );
  }
);

test(
  "fails clearly when the configured webhook secret environment variable is missing",
  () => {
    const config = {
      endpoint:
        "http://localhost:3000/webhook",
      eventsDir:
        ".spoke/events",
      timeoutMs: 5000,
      replay: {
        webhookSecretEnv:
          "STRIPE_WEBHOOK_SECRET"
      }
    };

    assert.throws(
      () =>
        createReplayRequestOptions(
          fixture,
          config,
          {}
        ),
      /STRIPE_WEBHOOK_SECRET is not set/
    );
  }
);
