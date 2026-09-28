import test from "node:test";
import assert from "node:assert/strict";

import {
  mkdtemp,
  writeFile
} from "node:fs/promises";

import {
  tmpdir
} from "node:os";

import {
  join
} from "node:path";

import {
  runAssertionCommand
} from "../dist/index.js";

const fixture = {
  event: {
    id: "evt_test_001",
    provider: "test-provider",
    type: "test.event",
    payload: {}
  },
  baseline: null
};

async function createProjectScript(
  source
) {
  const projectRoot =
    await mkdtemp(
      join(
        tmpdir(),
        "spoke-assertion-test-"
      )
    );

  await writeFile(
    join(
      projectRoot,
      "assertion.mjs"
    ),
    source,
    "utf8"
  );

  return projectRoot;
}

test(
  "runs an assertion command and parses JSON output",
  async () => {
    const projectRoot =
      await createProjectScript(`
console.log(JSON.stringify({
  ok: true,
  cwd: process.cwd(),
  custom: process.env.TEST_VALUE,
  eventId: process.env.SPOKE_EVENT_ID,
  provider: process.env.SPOKE_EVENT_PROVIDER,
  eventType: process.env.SPOKE_EVENT_TYPE
}));
`);

    const result =
      await runAssertionCommand(
        {
          command:
            process.execPath,
          args: [
            "assertion.mjs"
          ]
        },
        projectRoot,
        fixture,
        {
          TEST_VALUE:
            "inherited-value"
        }
      );

    assert.deepEqual(
      result,
      {
        ok: true,
        cwd: projectRoot,
        custom:
          "inherited-value",
        eventId:
          "evt_test_001",
        provider:
          "test-provider",
        eventType:
          "test.event"
      }
    );
  }
);

test(
  "fails when the assertion command exits non-zero",
  async () => {
    const projectRoot =
      await createProjectScript(`
console.error("assertion failed");
process.exit(9);
`);

    await assert.rejects(
      runAssertionCommand(
        {
          command:
            process.execPath,
          args: [
            "assertion.mjs"
          ]
        },
        projectRoot,
        fixture
      ),
      /exited with code 9: assertion failed/
    );
  }
);

test(
  "fails when the assertion command returns invalid JSON",
  async () => {
    const projectRoot =
      await createProjectScript(`
console.log("not-json");
`);

    await assert.rejects(
      runAssertionCommand(
        {
          command:
            process.execPath,
          args: [
            "assertion.mjs"
          ]
        },
        projectRoot,
        fixture
      ),
      /returned invalid JSON/
    );
  }
);

test(
  "fails when the assertion command returns empty output",
  async () => {
    const projectRoot =
      await createProjectScript(`
console.error("nothing on stdout");
`);

    await assert.rejects(
      runAssertionCommand(
        {
          command:
            process.execPath,
          args: [
            "assertion.mjs"
          ]
        },
        projectRoot,
        fixture
      ),
      /returned empty output/
    );
  }
);

test(
  "fails when the assertion command times out",
  async () => {
    const projectRoot =
      await createProjectScript(`
await new Promise(
  (resolve) =>
    setTimeout(
      resolve,
      1000
    )
);

console.log("{}");
`);

    await assert.rejects(
      runAssertionCommand(
        {
          command:
            process.execPath,
          args: [
            "assertion.mjs"
          ],
          timeoutMs: 50
        },
        projectRoot,
        fixture
      ),
      /timed out after 50ms/
    );
  }
);

test(
  "fails when the assertion command cannot be started",
  async () => {
    const projectRoot =
      await createProjectScript(
        `console.log("{}");`
      );

    await assert.rejects(
      runAssertionCommand(
        {
          command:
            "spoke-command-that-does-not-exist"
        },
        projectRoot,
        fixture
      ),
      /failed to start/
    );
  }
);