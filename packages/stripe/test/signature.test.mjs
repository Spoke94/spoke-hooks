import test from "node:test";
import assert from "node:assert/strict";

import {
  createStripeSignatureHeader
} from "../dist/index.js";

test(
  "creates a deterministic Stripe signature header",
  () => {
    const body =
      '{"id":"evt_test_001","type":"payment_intent.succeeded"}';

    const signature =
      createStripeSignatureHeader(
        body,
        "whsec_test_secret",
        1720000000
      );

    assert.equal(
      signature,
      "t=1720000000,v1=50bad1c181a718227a663c543181ecc57b5d9b15f579557fa8ac457099debbfc"
    );
  }
);

test(
  "signature changes when the body changes",
  () => {
    const first =
      createStripeSignatureHeader(
        '{"amount":1000}',
        "whsec_test_secret",
        1720000000
      );

    const second =
      createStripeSignatureHeader(
        '{"amount":1001}',
        "whsec_test_secret",
        1720000000
      );

    assert.notEqual(
      first,
      second
    );
  }
);