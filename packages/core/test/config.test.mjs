import test from "node:test";
import assert from "node:assert/strict";

import {
  mkdir,
  mkdtemp,
  writeFile
} from "node:fs/promises";

import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  loadConfig
} from "../dist/index.js";

async function createProject(
  config
) {
  const projectRoot = await mkdtemp(
    join(
      tmpdir(),
      "spoke-config-test-"
    )
  );

  const spokeDir = join(
    projectRoot,
    ".spoke"
  );

  await mkdir(
    spokeDir,
    {
      recursive: true
    }
  );

  await writeFile(
    join(
      spokeDir,
      "config.json"
    ),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8"
  );

  return projectRoot;
}

test(
  "loads the legacy config without replay signing",
  async () => {
    const projectRoot =
      await createProject({
        endpoint:
          "http://localhost:3000/webhook",
        eventsDir:
          ".spoke/events",
        timeoutMs: 5000
      });

    const config =
      await loadConfig(
        projectRoot
      );

    assert.equal(
      config.replay,
      undefined
    );
  }
);

test(
  "loads webhook secret environment configuration",
  async () => {
    const projectRoot =
      await createProject({
        endpoint:
          "http://localhost:3000/webhook",
        eventsDir:
          ".spoke/events",
        timeoutMs: 5000,
        replay: {
          webhookSecretEnv:
            "STRIPE_WEBHOOK_SECRET"
        }
      });

    const config =
      await loadConfig(
        projectRoot
      );

    assert.equal(
      config.replay?.webhookSecretEnv,
      "STRIPE_WEBHOOK_SECRET"
    );
  }
);

test(
  "rejects an empty webhook secret environment name",
  async () => {
    const projectRoot =
      await createProject({
        endpoint:
          "http://localhost:3000/webhook",
        eventsDir:
          ".spoke/events",
        timeoutMs: 5000,
        replay: {
          webhookSecretEnv: ""
        }
      });

    await assert.rejects(
      loadConfig(
        projectRoot
      ),
      /Invalid Spoke config/
    );
  }
);

test(
  "loads assertion command configuration",
  async () => {
    const projectRoot =
      await createProject({
        endpoint:
          "http://localhost:3000/webhook",
        eventsDir:
          ".spoke/events",
        timeoutMs: 5000,
        assertion: {
          command: "node",
          args: [
            "scripts/spoke-state.mjs"
          ],
          timeoutMs: 1000
        }
      });

    const config =
      await loadConfig(
        projectRoot
      );

    assert.deepEqual(
      config.assertion,
      {
        command: "node",
        args: [
          "scripts/spoke-state.mjs"
        ],
        timeoutMs: 1000
      }
    );
  }
);

test(
  "rejects invalid assertion command configuration",
  async () => {
    const invalidAssertions = [
      {},
      {
        command: ""
      },
      {
        command: "node",
        args: [1]
      },
      {
        command: "node",
        timeoutMs: 0
      }
    ];

    for (const assertionConfig of invalidAssertions) {
      const projectRoot =
        await createProject({
          endpoint:
            "http://localhost:3000/webhook",
          eventsDir:
            ".spoke/events",
          timeoutMs: 5000,
          assertion:
            assertionConfig
        });

      await assert.rejects(
        loadConfig(
          projectRoot
        ),
        /Invalid Spoke config/
      );
    }
  }
);
