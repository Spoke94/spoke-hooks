import test from "node:test";
import assert from "node:assert/strict";

import {
  redactStripeEvent
} from "../dist/index.js";

test("redacts common Stripe customer PII without changing business fields", () => {
  const event = {
    id: "evt_invoice_paid_001",
    type: "invoice.paid",
    data: {
      object: {
        id: "in_001",
        amount_paid: 4900,
        currency: "usd",

        customer_email: "alice@example.com",
        customer_name: "Alice Example",
        customer_phone: "+15551234567",

        customer_address: {
          line1: "123 Main Street",
          line2: "Apartment 4",
          city: "San Francisco",
          state: "CA",
          postal_code: "94105",
          country: "US"
        }
      }
    }
  };

  const redacted = redactStripeEvent(event);

  assert.equal(
    redacted.data.object.customer_email,
    "[REDACTED]"
  );

  assert.equal(
    redacted.data.object.customer_name,
    "[REDACTED]"
  );

  assert.equal(
    redacted.data.object.customer_phone,
    "[REDACTED]"
  );

  assert.deepEqual(
    redacted.data.object.customer_address,
    {
        line1: "[REDACTED]",
        line2: "[REDACTED]",
        city: "[REDACTED]",
        state: "[REDACTED]",
        postal_code: "[REDACTED]",
        country: "[REDACTED]"
    }
  );

  assert.equal(
    redacted.id,
    "evt_invoice_paid_001"
  );

  assert.equal(
    redacted.type,
    "invoice.paid"
  );

  assert.equal(
    redacted.data.object.amount_paid,
    4900
  );

  assert.equal(
    redacted.data.object.currency,
    "usd"
  );
});

test("does not mutate the original Stripe event", () => {
  const event = {
    id: "evt_immutable_001",
    type: "invoice.paid",
    data: {
      object: {
        amount_paid: 4900,
        customer_email: "alice@example.com"
      }
    }
  };

  const before = JSON.stringify(event);

  redactStripeEvent(event);

  assert.equal(
    JSON.stringify(event),
    before
  );
});

test("redacts supported PII recursively inside nested arrays", () => {
  const event = {
    id: "evt_nested_001",
    type: "customer.updated",
    data: {
      object: {
        history: [
          {
            customer_email: "old@example.com"
          },
          {
            customer_phone: "+15550001111",
            customer_address: {
              city: "Example City",
              country: "US"
            }
          }
        ]
      }
    }
  };

  const redacted = redactStripeEvent(event);

  assert.equal(
    redacted.data.object.history[0].customer_email,
    "[REDACTED]"
  );

  assert.equal(
    redacted.data.object.history[1].customer_phone,
    "[REDACTED]"
  );

  assert.deepEqual(
    redacted.data.object.history[1].customer_address,
    {
      city: "[REDACTED]",
      country: "[REDACTED]"
    }
  );
});

test("does not redact unrelated business fields", () => {
  const event = {
    id: "evt_product_001",
    type: "invoice.paid",
    data: {
      object: {
        amount_paid: 4900,
        currency: "usd",
        description: "Pro plan renewal",
        product: {
          id: "prod_001",
          name: "Pro Plan"
        }
      }
    }
  };

  const redacted = redactStripeEvent(event);

  assert.equal(
    redacted.data.object.description,
    "Pro plan renewal"
  );

  assert.equal(
    redacted.data.object.product.name,
    "Pro Plan"
  );

  assert.equal(
    redacted.data.object.amount_paid,
    4900
  );

  assert.equal(
    redacted.data.object.currency,
    "usd"
  );
});

test("redacts PII inside known Stripe customer contexts", () => {
  const event = {
    id: "evt_payment_001",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_001",
        amount: 4900,
        currency: "usd",
        receipt_email: "customer@example.com",

        billing_details: {
          name: "Example Customer",
          email: "customer@example.com",
          phone: "+15550001111",
          address: {
            line1: "123 Example Street",
            city: "Example City",
            postal_code: "10001",
            country: "US"
          }
        },

        product: {
          id: "prod_001",
          name: "Pro Plan"
        }
      }
    }
  };

  const redacted = redactStripeEvent(event);

  assert.equal(
    redacted.data.object.receipt_email,
    "[REDACTED]"
  );

  assert.equal(
    redacted.data.object.billing_details.name,
    "[REDACTED]"
  );

  assert.equal(
    redacted.data.object.billing_details.email,
    "[REDACTED]"
  );

  assert.equal(
    redacted.data.object.billing_details.phone,
    "[REDACTED]"
  );

  assert.deepEqual(
    redacted.data.object.billing_details.address,
    {
      line1: "[REDACTED]",
      city: "[REDACTED]",
      postal_code: "[REDACTED]",
      country: "[REDACTED]"
    }
  );

  assert.equal(
    redacted.data.object.amount,
    4900
  );

  assert.equal(
    redacted.data.object.currency,
    "usd"
  );

  assert.equal(
    redacted.data.object.product.name,
    "Pro Plan"
  );
});
