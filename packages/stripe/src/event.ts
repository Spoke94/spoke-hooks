import type {
  WebhookFixture
} from "@spokelabs/core";

export function createStripeFixture(
  value: unknown
): WebhookFixture {
  if (!isRecord(value)) {
    throw new Error(
      "Invalid Stripe event: expected a JSON object."
    );
  }

  if (
    typeof value.id !== "string" ||
    value.id.length === 0
  ) {
    throw new Error(
      "Invalid Stripe event: missing event id."
    );
  }

  if (
    typeof value.type !== "string" ||
    value.type.length === 0
  ) {
    throw new Error(
      "Invalid Stripe event: missing event type."
    );
  }

  return {
    event: {
      id: value.id,
      provider: "stripe",
      type: value.type,
      payload: value
    },
    baseline: null
  };
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}