import test from "node:test";
import assert from "node:assert/strict";

import { spawn } from "node:child_process";
import { once } from "node:events";

import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";

import { tmpdir } from "node:os";
import {
  dirname,
  join,
  resolve
} from "node:path";

import {
  fileURLToPath
} from "node:url";

import express from "express";
import Stripe from "stripe";

import {
  createStripeSignatureHeader
} from "../../../packages/stripe/dist/index.js";

const testDir = dirname(
  fileURLToPath(import.meta.url)
);

const cliPath = resolve(
  testDir,
  "../../../packages/cli/dist/index.js"
);

async function startVerificationServer(
  secret
) {
  const app = express();

  const stripe = new Stripe(
    "sk_test_spoke_hooks_e2e"
  );

  let requestCount = 0;
  let verifiedCount = 0;

  app.post(
    "/webhook",
    express.raw({
      type: "application/json"
    }),
    (request, response) => {
      requestCount += 1;

      const signature =
        request.headers["stripe-signature"];

      if (typeof signature !== "string") {
        response.status(400).json({
          error:
            "Missing Stripe-Signature header."
        });

        return;
      }

      try {
        stripe.webhooks.constructEvent(
          request.body,
          signature,
          secret
        );

        verifiedCount += 1;

        response.status(200).json({
          received: true
        });
      } catch {
        response.status(400).json({
          error:
            "Invalid Stripe signature."
        });
      }
    }
  );

  const server = app.listen(
    0,
    "127.0.0.1"
  );

  await once(
    server,
    "listening"
  );

  const address = server.address();

  assert.notEqual(
    address,
    null
  );

  assert.equal(
    typeof address,
    "object"
  );

  return {
    server,
    url:
      `http://127.0.0.1:${address.port}/webhook`,
    getRequestCount:
      () => requestCount,
    getVerifiedCount:
      () => verifiedCount
  };
}

async function closeServer(
  server
) {
  await new Promise(
    (resolve, reject) => {
      server.close((error) => {
        if (error !== undefined) {
          reject(error);
          return;
        }

        resolve();
      });
    }
  );
}

async function createProject(
  endpoint,
  baseline = null
) {
  const projectRoot =
    await mkdtemp(
      join(
        tmpdir(),
        "spoke-signing-e2e-"
      )
    );

  const spokeDir = join(
    projectRoot,
    ".spoke"
  );

  const eventsDir = join(
    spokeDir,
    "events"
  );

  await mkdir(
    eventsDir,
    {
      recursive: true
    }
  );

  const config = {
    endpoint,
    eventsDir:
      ".spoke/events",
    timeoutMs: 5000,
    replay: {
      webhookSecretEnv:
        "STRIPE_WEBHOOK_SECRET"
    }
  };

  const fixture = {
    event: {
      id:
        "evt_signing_e2e_001",
      provider:
        "stripe",
      type:
        "invoice.paid",
      payload: {
        id:
          "evt_signing_e2e_001",
        type:
          "invoice.paid",
        data: {
          object: {
            id:
              "in_signing_e2e_001",
            status:
              "paid"
          }
        }
      }
    },
    baseline
  };

  await writeFile(
    join(
      spokeDir,
      "config.json"
    ),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8"
  );

  await writeFile(
    join(
      eventsDir,
      "invoice-paid.json"
    ),
    `${JSON.stringify(fixture, null, 2)}\n`,
    "utf8"
  );

  return projectRoot;
}

async function runCli(
  projectRoot,
  command,
  secret
) {
  const environment = {
    ...process.env
  };

  if (secret === undefined) {
    delete environment.STRIPE_WEBHOOK_SECRET;
  } else {
    environment.STRIPE_WEBHOOK_SECRET =
      secret;
  }

  const child = spawn(
    process.execPath,
    [
      cliPath,
      command
    ],
    {
      cwd: projectRoot,
      env: environment,
      stdio: [
        "ignore",
        "pipe",
        "pipe"
      ]
    }
  );

  let stdout = "";
  let stderr = "";

  child.stdout.setEncoding(
    "utf8"
  );

  child.stderr.setEncoding(
    "utf8"
  );

  child.stdout.on(
    "data",
    (chunk) => {
      stdout += chunk;
    }
  );

  child.stderr.on(
    "data",
    (chunk) => {
      stderr += chunk;
    }
  );

  const [
    code,
    signal
  ] = await once(
    child,
    "close"
  );

  return {
    code,
    signal,
    stdout,
    stderr
  };
}

test(
  "baseline and test replay through real Stripe signature verification",
  async (t) => {
    const secret =
      "whsec_spoke_hooks_e2e";

    const verification =
      await startVerificationServer(
        secret
      );

    const projectRoot =
      await createProject(
        verification.url
      );

    t.after(
      async () => {
        await closeServer(
          verification.server
        );

        await rm(
          projectRoot,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    const baselineResult =
      await runCli(
        projectRoot,
        "baseline",
        secret
      );

    assert.equal(
      baselineResult.code,
      0,
      baselineResult.stderr
    );

    assert.equal(
      verification.getVerifiedCount(),
      1
    );

    const fixtureContent =
      await readFile(
        join(
          projectRoot,
          ".spoke",
          "events",
          "invoice-paid.json"
        ),
        "utf8"
      );

    const fixture =
      JSON.parse(
        fixtureContent
      );

    assert.deepEqual(
      fixture.baseline,
      {
        status: 200,
        body: {
          received: true
        }
      }
    );

    const testResult =
      await runCli(
        projectRoot,
        "test",
        secret
      );

    assert.equal(
      testResult.code,
      0,
      testResult.stderr
    );

    assert.match(
      testResult.stdout,
      /PASS/
    );

    assert.equal(
      verification.getVerifiedCount(),
      2
    );
  }
);

test(
  "CLI fails when replay is signed with the wrong secret",
  async (t) => {
    const serverSecret =
      "whsec_server_secret";

    const verification =
      await startVerificationServer(
        serverSecret
      );

    const projectRoot =
      await createProject(
        verification.url,
        {
          status: 200,
          body: {
            received: true
          }
        }
      );

    t.after(
      async () => {
        await closeServer(
          verification.server
        );

        await rm(
          projectRoot,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    const result =
      await runCli(
        projectRoot,
        "test",
        "whsec_wrong_secret"
      );

    assert.equal(
      result.code,
      1
    );

    assert.match(
      result.stderr,
      /FAIL/
    );

    assert.equal(
      verification.getRequestCount(),
      1
    );

    assert.equal(
      verification.getVerifiedCount(),
      0
    );
  }
);

test(
  "Stripe verification rejects a body changed after signing",
  async (t) => {
    const secret =
      "whsec_tamper_test";

    const verification =
      await startVerificationServer(
        secret
      );

    t.after(
      async () => {
        await closeServer(
          verification.server
        );
      }
    );

    const originalBody =
      JSON.stringify({
        id: "evt_tamper_001",
        type:
          "payment_intent.succeeded",
        data: {
          object: {
            amount: 4900
          }
        }
      });

    const signature =
      createStripeSignatureHeader(
        originalBody,
        secret,
        Math.floor(
          Date.now() / 1000
        )
      );

    const tamperedBody =
      JSON.stringify({
        id: "evt_tamper_001",
        type:
          "payment_intent.succeeded",
        data: {
          object: {
            amount: 9900
          }
        }
      });

    const response = await fetch(
      verification.url,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
          "stripe-signature":
            signature
        },
        body:
          tamperedBody
      }
    );

    assert.equal(
      response.status,
      400
    );

    assert.equal(
      verification.getVerifiedCount(),
      0
    );
  }
);