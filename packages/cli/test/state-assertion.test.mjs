import test from "node:test";
import assert from "node:assert/strict";

import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";

import {
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from "node:fs/promises";

import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const cliPath = resolve(
  "packages/cli/dist/index.js"
);

async function startServer(
  responseBody
) {
  let requestCount = 0;

  const server = createServer(
    async (request, response) => {
      requestCount += 1;

      for await (const _chunk of request) {
        // Consume request body.
      }

      response.writeHead(
        200,
        {
          "content-type":
            "application/json"
        }
      );

      response.end(
        JSON.stringify(
          responseBody
        )
      );
    }
  );

  server.listen(
    0,
    "127.0.0.1"
  );

  await once(
    server,
    "listening"
  );

  const address =
    server.address();

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
    getRequestCount() {
      return requestCount;
    }
  };
}

async function closeServer(
  server
) {
  await new Promise(
    (resolveClose, rejectClose) => {
      server.close(
        (error) => {
          if (
            error !== undefined
          ) {
            rejectClose(
              error
            );
            return;
          }

          resolveClose();
        }
      );
    }
  );
}

async function createProject(
  endpoint,
  {
    baselineBody = {
      received: true
    },
    baselineState = {
      count: 1,
      eventId:
        "evt_state_001"
    },
    includeState = true,
    actualState = {
      count: 1
    }
  } = {}
) {
  const projectRoot =
    await mkdtemp(
      join(
        tmpdir(),
        "spoke-state-test-"
      )
    );

  const spokeDir =
    join(
      projectRoot,
      ".spoke"
    );

  const eventsDir =
    join(
      spokeDir,
      "events"
    );

  await mkdir(
    eventsDir,
    {
      recursive: true
    }
  );

  await writeFile(
    join(
      projectRoot,
      "state.json"
    ),
    `${JSON.stringify(
      actualState
    )}\n`,
    "utf8"
  );

  await writeFile(
    join(
      projectRoot,
      "assertion.mjs"
    ),
    `
import {
  readFile
} from "node:fs/promises";

const state =
  JSON.parse(
    await readFile(
      "state.json",
      "utf8"
    )
  );

console.log(
  JSON.stringify({
    ...state,
    eventId:
      process.env.SPOKE_EVENT_ID
  })
);
`,
    "utf8"
  );

  await writeFile(
    join(
      spokeDir,
      "config.json"
    ),
    `${JSON.stringify(
      {
        endpoint,
        eventsDir:
          ".spoke/events",
        timeoutMs: 5000,
        assertion: {
          command:
            process.execPath,
          args: [
            "assertion.mjs"
          ],
          timeoutMs: 1000
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const baseline = {
    status: 200,
    body:
      baselineBody
  };

  if (includeState) {
    baseline.state =
      baselineState;
  }

  await writeFile(
    join(
      eventsDir,
      "event.json"
    ),
    `${JSON.stringify(
      {
        event: {
          id:
            "evt_state_001",
          provider:
            "test-provider",
          type:
            "subscription.created",
          payload: {
            id:
              "evt_state_001"
          }
        },
        baseline
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return projectRoot;
}

async function runTestCommand(
  projectRoot
) {
  const child = spawn(
    process.execPath,
    [
      cliPath,
      "test"
    ],
    {
      cwd:
        projectRoot,
      env:
        process.env,
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

  const [code] =
    await once(
      child,
      "close"
    );

  return {
    code,
    stdout,
    stderr
  };
}

test(
  "passes when HTTP response and assertion state match",
  async (t) => {
    const endpoint =
      await startServer({
        received: true
      });

    const projectRoot =
      await createProject(
        endpoint.url
      );

    t.after(
      async () => {
        await closeServer(
          endpoint.server
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
      await runTestCommand(
        projectRoot
      );

    assert.equal(
      result.code,
      0,
      result.stderr
    );

    assert.match(
      result.stdout,
      /PASS/
    );

    assert.equal(
      endpoint.getRequestCount(),
      1
    );
  }
);

test(
  "fails when HTTP matches but assertion state changes",
  async (t) => {
    const endpoint =
      await startServer({
        received: true
      });

    const projectRoot =
      await createProject(
        endpoint.url,
        {
          actualState: {
            count: 2
          }
        }
      );

    t.after(
      async () => {
        await closeServer(
          endpoint.server
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
      await runTestCommand(
        projectRoot
      );

    assert.equal(
      result.code,
      1
    );

    assert.match(
      result.stderr,
      /Assertion state does not match the recorded baseline/
    );

    assert.equal(
      endpoint.getRequestCount(),
      1
    );
  }
);

test(
  "fails when HTTP changes even if assertion state matches",
  async (t) => {
    const endpoint =
      await startServer({
        received: false
      });

    const projectRoot =
      await createProject(
        endpoint.url
      );

    t.after(
      async () => {
        await closeServer(
          endpoint.server
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
      await runTestCommand(
        projectRoot
      );

    assert.equal(
      result.code,
      1
    );

    assert.match(
      result.stderr,
      /FAIL/
    );

    assert.doesNotMatch(
      result.stderr,
      /Assertion state does not match/
    );

    assert.equal(
      endpoint.getRequestCount(),
      1
    );
  }
);

test(
  "fails before replay when assertion state baseline is missing",
  async (t) => {
    const endpoint =
      await startServer({
        received: true
      });

    const projectRoot =
      await createProject(
        endpoint.url,
        {
          includeState:
            false
        }
      );

    t.after(
      async () => {
        await closeServer(
          endpoint.server
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
      await runTestCommand(
        projectRoot
      );

    assert.equal(
      result.code,
      1
    );

    assert.match(
      result.stderr,
      /No assertion state baseline recorded/
    );

    assert.equal(
      endpoint.getRequestCount(),
      0
    );
  }
);

test(
  "reports assertion command failures cleanly",
  async (t) => {
    const endpoint =
      await startServer({
        received: true
      });

    const projectRoot =
      await createProject(
        endpoint.url
      );

    await writeFile(
      join(
        projectRoot,
        "assertion.mjs"
      ),
      `
console.error("assertion failed");
process.exit(9);
`,
      "utf8"
    );

    t.after(
      async () => {
        await closeServer(
          endpoint.server
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
      await runTestCommand(
        projectRoot
      );

    assert.equal(
      result.code,
      1
    );

    assert.match(
      result.stderr,
      /ERROR: Assertion command exited with code 9: assertion failed/
    );

    assert.doesNotMatch(
      result.stderr,
      /AssertionCommandError:/
    );

    assert.equal(
      endpoint.getRequestCount(),
      1
    );
  }
);
