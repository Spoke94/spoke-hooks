import { createHmac } from "node:crypto";

export function createStripeSignatureHeader(
  body: string,
  secret: string,
  timestamp: number
): string {
  if (secret.length === 0) {
    throw new Error(
      "Stripe webhook secret must not be empty."
    );
  }

  if (
    !Number.isInteger(timestamp) ||
    timestamp <= 0
  ) {
    throw new Error(
      "Stripe signature timestamp must be a positive integer."
    );
  }

  const signedPayload =
    `${timestamp}.${body}`;

  const signature = createHmac(
    "sha256",
    secret
  )
    .update(
      signedPayload,
      "utf8"
    )
    .digest("hex");

  return `t=${timestamp},v1=${signature}`;
}