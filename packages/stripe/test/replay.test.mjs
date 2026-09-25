import test from "node:test";
import assert from "node:assert/strict";

import {
  createStripeReplayRequest,
  createStripeSignatureHeader
} from "../dist/index.js";

test(
  "creates a signed replay request from a Stripe fixture",
  () => {
    const fixture = {
      event: {
        id: "evt_test_001",
        provider: "stripe",
        type: "payment_intent.succeeded",
        payload: {
          id: "evt_test_001",
          type: "payment_intent.succeeded",
          data: {
            object: {
              amount: 4900
            }
          }
        }
      },
      baseline: null
    };

    const timestamp = 1720000000;

    const request =
      createStripeReplayRequest(
        fixture,
        "whsec_test_secret",
        timestamp
      );

    const expectedBody =
      JSON.stringify(
        fixture.event.payload
      );

    assert.equal(
      request.body,
      expectedBody
    );

    assert.equal(
      request.headers?.["stripe-signature"],
      createStripeSignatureHeader(
        expectedBody,
        "whsec_test_secret",
        timestamp
      )
    );
  }
);

test(
  "rejects non-Stripe fixtures",
  () => {
    const fixture = {
      event: {
        id: "evt_test_001",
        provider: "other",
        type: "test.event",
        payload: {}
      },
      baseline: null
    };

    assert.throws(
      () =>
        createStripeReplayRequest(
          fixture,
          "whsec_test_secret",
          1720000000
        ),
      /non-Stripe fixture/
    );
  }
);