import test from "node:test";
import assert from "node:assert/strict";

import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";

import {
  mkdir,
  mkdtemp,
  readFile,
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
      for await (const _chunk of request) {
        // Consume request body.
      }

      requestCount += 1;

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
    getRequestCount:
      () => requestCount,
    url:
      `http://127.0.0.1:${address.port}/webhook`
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
  endpoint
) {
  const projectRoot =
    await mkdtemp(
      join(
        tmpdir(),
        "spoke-baseline-duplicate-"
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
          sequential: 1
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const fixturePath =
    join(
      eventsDir,
      "event.json"
    );

  await writeFile(
    fixturePath,
    `${JSON.stringify(
      {
        event: {
          id:
            "evt_duplicate_001",
          provider:
            "test-provider",
          type:
            "test.event",
          payload: {
            id:
              "evt_duplicate_001"
          }
        },
        baseline: null
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return {
    fixturePath,
    projectRoot
  };
}

async function createAssertionProject(
  endpoint,
  {
    failOnSecondAssertion = false,
    baseline = null
  } = {}
) {
  const projectRoot =
    await mkdtemp(
      join(
        tmpdir(),
        "spoke-baseline-duplicate-assertion-"
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

if (
  ${failOnSecondAssertion} &&
  current === 2
) {
  console.error(
    "second assertion failed"
  );

  process.exit(1);
}

console.log(
  JSON.stringify({
    assertionRun: current,
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

  const fixturePath =
    join(
      eventsDir,
      "event.json"
    );

  const fixture = {
    event: {
      id:
        "evt_duplicate_assertion_001",
      provider:
        "test-provider",
      type:
        "test.event",
      payload: {
        id:
          "evt_duplicate_assertion_001"
      }
    },
    baseline
  };

  await writeFile(
    fixturePath,
    `${JSON.stringify(
      fixture,
      null,
      2
    )}\n`,
    "utf8"
  );

  return {
    fixture,
    fixturePath,
    projectRoot
  };
}

async function runBaseline(
  projectRoot
) {
  const child = spawn(
    process.execPath,
    [
      cliPath,
      "baseline"
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

  let stderr = "";

  child.stderr.setEncoding(
    "utf8"
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
    stderr
  };
}

test(
  "baseline records sequential duplicate observations",
  async (t) => {
    const endpoint =
      await startServer();

    const project =
      await createProject(
        endpoint.url
      );

    t.after(
      async () => {
        await closeServer(
          endpoint.server
        );

        await rm(
          project.projectRoot,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    const result =
      await runBaseline(
        project.projectRoot
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

    const fixture =
      JSON.parse(
        await readFile(
          project.fixturePath,
          "utf8"
        )
      );

    assert.deepEqual(
      fixture.baseline,
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
  }
);

test(
  "baseline captures assertion state after each sequential delivery",
  async (t) => {
    const endpoint =
      await startServer();

    const project =
      await createAssertionProject(
        endpoint.url
      );

    t.after(
      async () => {
        await closeServer(
          endpoint.server
        );

        await rm(
          project.projectRoot,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    const result =
      await runBaseline(
        project.projectRoot
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

    const fixture =
      JSON.parse(
        await readFile(
          project.fixturePath,
          "utf8"
        )
      );

    assert.deepEqual(
      fixture.baseline,
      {
        status: 200,
        body: {
          delivery: 1
        },
        state: {
          assertionRun: 1,
          eventId:
            "evt_duplicate_assertion_001"
        },
        sequentialDuplicates: [
          {
            status: 200,
            body: {
              delivery: 2
            },
            state: {
              assertionRun: 2,
              eventId:
                "evt_duplicate_assertion_001"
            }
          }
        ]
      }
    );
  }
);

test(
  "baseline does not persist a partial sequence when a later assertion fails",
  async (t) => {
    const endpoint =
      await startServer();

    const existingBaseline = {
      status: 201,
      body: {
        existing: true
      }
    };

    const project =
      await createAssertionProject(
        endpoint.url,
        {
          failOnSecondAssertion:
            true,
          baseline:
            existingBaseline
        }
      );

    t.after(
      async () => {
        await closeServer(
          endpoint.server
        );

        await rm(
          project.projectRoot,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    const result =
      await runBaseline(
        project.projectRoot
      );

    assert.equal(
      result.code,
      1
    );

    assert.equal(
      endpoint.getRequestCount(),
      2
    );

    const fixture =
      JSON.parse(
        await readFile(
          project.fixturePath,
          "utf8"
        )
      );

    assert.deepEqual(
      fixture.baseline,
      existingBaseline
    );
  }
);
