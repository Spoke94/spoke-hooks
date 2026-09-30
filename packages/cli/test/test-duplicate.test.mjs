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

async function startServer() {
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
        JSON.stringify({
          delivery: requestCount
        })
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
          if (error !== undefined) {
            rejectClose(error);
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
  baseline = {
    status: 200,
    body: {
      received: true
    }
  },
  sequential = 1
) {
  const projectRoot =
    await mkdtemp(
      join(
        tmpdir(),
        "spoke-test-duplicate-"
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
      spokeDir,
      "config.json"
    ),
    `${JSON.stringify(
      {
        endpoint,
        eventsDir:
          ".spoke/events",
        timeoutMs: 5000,
        duplicates: {
          sequential
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  await writeFile(
    join(
      eventsDir,
      "event.json"
    ),
    `${JSON.stringify(
      {
        event: {
          id:
            "evt_duplicate_test_001",
          provider:
            "test-provider",
          type:
            "test.event",
          payload: {
            id:
              "evt_duplicate_test_001"
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

async function createAssertionProject(
  endpoint,
  baseline = {
    status: 200,
    body: {
      delivery: 1
    },
    state: {
        run: 1
    },
    sequentialDuplicates: [
      {
        status: 200,
        body: {
          delivery: 2
        },
        state: {
          run: 999
        }
      }
    ]
  }
) {
  const projectRoot =
    await mkdtemp(
      join(
        tmpdir(),
        "spoke-test-duplicate-assertion-"
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
      "assertion-count.json"
    ),
    "0\n",
    "utf8"
  );

  await writeFile(
    join(
      projectRoot,
      "assertion.mjs"
    ),
    `
import {
  readFile,
  writeFile
} from "node:fs/promises";

const countPath =
  "assertion-count.json";

const previous =
  Number(
    await readFile(
      countPath,
      "utf8"
    )
  );

const current =
  previous + 1;

await writeFile(
  countPath,
  \`\${current}\\n\`,
  "utf8"
);

console.log(
  JSON.stringify({
    run: current
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
        duplicates: {
          sequential: 1
        },
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

  await writeFile(
    join(
      eventsDir,
      "event.json"
    ),
    `${JSON.stringify(
      {
        event: {
          id:
            "evt_duplicate_state_001",
          provider:
            "test-provider",
          type:
            "test.event",
          payload: {
            id:
              "evt_duplicate_state_001"
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
  "fails before replay when sequential duplicate baseline count does not match config",
  async (t) => {
    const endpoint =
      await startServer();

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

    assert.equal(
      endpoint.getRequestCount(),
      0
    );

    assert.match(
      result.stderr,
      /Sequential duplicate baseline does not match the configured replay count/
    );
  }
);

test(
  "passes when the sequential duplicate sequence matches its baseline",
  async (t) => {
    const endpoint =
      await startServer();

    const projectRoot =
      await createProject(
        endpoint.url,
        {
          status: 200,
          body: {
            delivery: 1
          },
          sequentialDuplicates: [
            {
              status: 200,
              body: {
                delivery: 2
              }
            }
          ]
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
      0,
      result.stderr
    );

    assert.equal(
      endpoint.getRequestCount(),
      2
    );

    const passCount =
      result.stdout.match(
        /\bPASS\b/g
      )?.length ?? 0;

    assert.equal(
      passCount,
      2
    );
  }
);

test(
  "fails when only the sequential duplicate HTTP response regresses",
  async (t) => {
    const endpoint =
      await startServer();

    const projectRoot =
      await createProject(
        endpoint.url,
        {
          status: 200,
          body: {
            delivery: 1
          },
          sequentialDuplicates: [
            {
              status: 200,
              body: {
                delivery: 999
              }
            }
          ]
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

    assert.equal(
      endpoint.getRequestCount(),
      2
    );

    assert.match(
      result.stdout,
      /Sequential duplicate #1/
    );
  }
);

test(
  "fails when duplicate HTTP matches but duplicate assertion state regresses",
  async (t) => {
    const endpoint =
      await startServer();

    const projectRoot =
      await createAssertionProject(
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

    assert.equal(
      endpoint.getRequestCount(),
      2
    );

    assert.match(
      result.stdout,
      /Sequential duplicate #1/
    );

    assert.match(
      result.stderr,
      /Assertion state does not match the recorded baseline/
    );
  }
);

test(
  "fails before replay when sequential duplicate assertion state baseline is missing",
  async (t) => {
    const endpoint =
      await startServer();

    const projectRoot =
      await createAssertionProject(
        endpoint.url,
        {
          status: 200,
          body: {
            delivery: 1
          },
          state: {
            run: 1
          },
          sequentialDuplicates: [
            {
              status: 200,
              body: {
                delivery: 2
              }
            }
          ]
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

    assert.equal(
      endpoint.getRequestCount(),
      0
    );

    assert.match(
      result.stderr,
      /No assertion state baseline recorded for a sequential duplicate/
    );
  }
);

test(
  "replays multiple sequential duplicates in order",
  async (t) => {
    const endpoint =
      await startServer();

    const projectRoot =
      await createProject(
        endpoint.url,
        {
          status: 200,
          body: {
            delivery: 1
          },
          sequentialDuplicates: [
            {
              status: 200,
              body: {
                delivery: 2
              }
            },
            {
              status: 200,
              body: {
                delivery: 3
              }
            }
          ]
        },
        2
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

    assert.equal(
      endpoint.getRequestCount(),
      3
    );

    assert.match(
      result.stdout,
      /Sequential duplicate #1/
    );

    assert.match(
      result.stdout,
      /Sequential duplicate #2/
    );
  }
);
