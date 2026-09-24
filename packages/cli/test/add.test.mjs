import test from "node:test";
import assert from "node:assert/strict";

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";

import {
  join
} from "node:path";

import {
  tmpdir
} from "node:os";

import {
  fileURLToPath
} from "node:url";

import {
  spawnSync
} from "node:child_process";

const cliPath = fileURLToPath(
  new URL("../dist/index.js", import.meta.url)
);

test("add cancels without writing when confirmation is not given", () => {
  const projectRoot = mkdtempSync(
    join(tmpdir(), "spoke-hooks-add-")
  );

  try {
    const spokeDir = join(
      projectRoot,
      ".spoke"
    );

    mkdirSync(
      spokeDir,
      {
        recursive: true
      }
    );

    writeFileSync(
      join(spokeDir, "config.json"),
      JSON.stringify(
        {
          endpoint: "http://localhost:3000/webhook",
          eventsDir: ".spoke/events",
          timeoutMs: 5000
        },
        null,
        2
      )
    );

    const eventPath = join(
      projectRoot,
      "event.json"
    );

    writeFileSync(
      eventPath,
      JSON.stringify(
        {
          id: "evt_add_cancel_001",
          type: "payment_intent.succeeded",
          data: {
            object: {
              receipt_email: "customer@example.com"
            }
          }
        },
        null,
        2
      )
    );

    const result = spawnSync(
      process.execPath,
      [
        cliPath,
        "add",
        "event.json"
      ],
      {
        cwd: projectRoot,
        input: "\n",
        encoding: "utf8"
      }
    );

    const fixturePath = join(
      projectRoot,
      ".spoke/events",
      "payment_intent.succeeded-evt_add_cancel_001.json"
    );

    assert.equal(
      result.status,
      0
    );

    assert.match(
      result.stdout,
      /Spoke Hooks will store:/
    );

    assert.match(
      result.stdout,
      /\[REDACTED\]/
    );

    assert.doesNotMatch(
      result.stdout,
      /customer@example\.com/
    );

    assert.match(
      result.stdout,
      /Cancelled\. No fixture was written\./
    );

    assert.equal(
      existsSync(
        join(
          projectRoot,
          ".spoke/events"
        )
      ),
      false
    );

    assert.equal(
      existsSync(fixturePath),
      false
    );
  } finally {
    rmSync(
      projectRoot,
      {
        recursive: true,
        force: true
      }
    );
  }
});

test("add previews and writes the redacted fixture after confirmation", () => {
  const projectRoot = mkdtempSync(
    join(tmpdir(), "spoke-hooks-add-")
  );

  try {
    const spokeDir = join(
      projectRoot,
      ".spoke"
    );

    mkdirSync(
      spokeDir,
      {
        recursive: true
      }
    );

    writeFileSync(
      join(spokeDir, "config.json"),
      JSON.stringify(
        {
          endpoint: "http://localhost:3000/webhook",
          eventsDir: ".spoke/events",
          timeoutMs: 5000
        },
        null,
        2
      )
    );

    const eventPath = join(
      projectRoot,
      "event.json"
    );

    writeFileSync(
      eventPath,
      JSON.stringify(
        {
          id: "evt_add_confirm_001",
          type: "payment_intent.succeeded",
          data: {
            object: {
              amount: 4900,
              currency: "usd",
              receipt_email: "customer@example.com",
              billing_details: {
                name: "Example Customer",
                email: "customer@example.com"
              },
              product: {
                name: "Pro Plan"
              }
            }
          }
        },
        null,
        2
      )
    );

    const result = spawnSync(
      process.execPath,
      [
        cliPath,
        "add",
        "event.json"
      ],
      {
        cwd: projectRoot,
        input: "y\n",
        encoding: "utf8"
      }
    );

    const fixturePath = join(
      projectRoot,
      ".spoke/events",
      "payment_intent.succeeded-evt_add_confirm_001.json"
    );

    assert.equal(
      result.status,
      0
    );

    assert.match(
      result.stdout,
      /Spoke Hooks will store:/
    );

    assert.match(
      result.stdout,
      /\[REDACTED\]/
    );

    assert.doesNotMatch(
      result.stdout,
      /customer@example\.com/
    );

    assert.match(
      result.stdout,
      /Added Stripe event: payment_intent\.succeeded/
    );

    assert.equal(
      existsSync(fixturePath),
      true
    );

    const fixture = JSON.parse(
      readFileSync(
        fixturePath,
        "utf8"
      )
    );

    assert.equal(
      fixture.event.payload.data.object.receipt_email,
      "[REDACTED]"
    );

    assert.equal(
      fixture.event.payload.data.object.billing_details.name,
      "[REDACTED]"
    );

    assert.equal(
      fixture.event.payload.data.object.billing_details.email,
      "[REDACTED]"
    );

    assert.equal(
      fixture.event.payload.data.object.amount,
      4900
    );

    assert.equal(
      fixture.event.payload.data.object.product.name,
      "Pro Plan"
    );
  } finally {
    rmSync(
      projectRoot,
      {
        recursive: true,
        force: true
      }
    );
  }
});

test("add --yes writes the redacted fixture without interactive confirmation", () => {
  const projectRoot = mkdtempSync(
    join(tmpdir(), "spoke-hooks-add-")
  );

  try {
    const spokeDir = join(
      projectRoot,
      ".spoke"
    );

    mkdirSync(
      spokeDir,
      {
        recursive: true
      }
    );

    writeFileSync(
      join(spokeDir, "config.json"),
      JSON.stringify(
        {
          endpoint: "http://localhost:3000/webhook",
          eventsDir: ".spoke/events",
          timeoutMs: 5000
        },
        null,
        2
      )
    );

    writeFileSync(
      join(projectRoot, "event.json"),
      JSON.stringify(
        {
          id: "evt_add_yes_001",
          type: "payment_intent.succeeded",
          data: {
            object: {
              receipt_email: "customer@example.com",
              amount: 4900
            }
          }
        },
        null,
        2
      )
    );

    const result = spawnSync(
      process.execPath,
      [
        cliPath,
        "add",
        "event.json",
        "--yes"
      ],
      {
        cwd: projectRoot,
        encoding: "utf8"
      }
    );

    const fixturePath = join(
      projectRoot,
      ".spoke/events",
      "payment_intent.succeeded-evt_add_yes_001.json"
    );

    assert.equal(
      result.status,
      0
    );

    assert.equal(
      existsSync(fixturePath),
      true
    );

    assert.match(
      result.stdout,
      /\[REDACTED\]/
    );

    assert.doesNotMatch(
      result.stdout,
      /customer@example\.com/
    );

    assert.doesNotMatch(
      result.stdout,
      /Save this fixture\?/
    );

    const fixture = JSON.parse(
      readFileSync(
        fixturePath,
        "utf8"
      )
    );

    assert.equal(
      fixture.event.payload.data.object.receipt_email,
      "[REDACTED]"
    );

    assert.equal(
      fixture.event.payload.data.object.amount,
      4900
    );
  } finally {
    rmSync(
      projectRoot,
      {
        recursive: true,
        force: true
      }
    );
  }
});
