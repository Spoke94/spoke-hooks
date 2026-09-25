import express from "express";
import Stripe from "stripe";

const app = express();
const port = 3000;

const webhookSecret =
  process.env.STRIPE_WEBHOOK_SECRET;

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY ??
    "sk_test_spoke_hooks_example"
);

app.post(
  "/webhook",
  express.raw({
    type: "application/json"
  }),
  (request, response) => {
    const rawBody =
      request.body as Buffer;

    if (webhookSecret !== undefined) {
      const signature =
        request.headers["stripe-signature"];

      if (typeof signature !== "string") {
        console.error(
          "Webhook verification failed: missing Stripe-Signature header."
        );

        response.status(400).json({
          error:
            "Missing Stripe-Signature header."
        });

        return;
      }

      try {
        const event =
          stripe.webhooks.constructEvent(
            rawBody,
            signature,
            webhookSecret
          );

        console.log(
          `Verified webhook received: ${event.type}`
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown Stripe signature error.";

        console.error(
          `Webhook verification failed: ${message}`
        );

        response.status(400).json({
          error:
            "Invalid Stripe signature."
        });

        return;
      }
    } else {
      try {
        const event = JSON.parse(
          rawBody.toString("utf8")
        );

        console.log(
          "Webhook received:"
        );

        console.log(event);
      } catch {
        response.status(400).json({
          error:
            "Invalid JSON payload."
        });

        return;
      }
    }

    response.status(200).json({
      received: true
    });
  }
);

app.listen(port, () => {
  console.log(
    `Example webhook server listening on http://localhost:${port}`
  );

  if (webhookSecret !== undefined) {
    console.log(
      "Stripe signature verification enabled."
    );
  } else {
    console.log(
      "Stripe signature verification disabled."
    );
  }
});
