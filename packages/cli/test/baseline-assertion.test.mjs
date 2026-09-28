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
  const server = createServer(
    async (request, response) => {
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
          received: true
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
  endpoint
) {
  const projectRoot =
    await mkdtemp(
      join(
        tmpdir(),
        "spoke-baseline-assertion-"
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
    `${JSON.stringify({
      created: 1
    })}\n`,
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

  const config = {
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
  };

  await writeFile(
    join(
      spokeDir,
      "config.json"
    ),
    `${JSON.stringify(
      config,
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
    baseline: null
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
  "baseline records assertion state",
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
          received: true
        },
        state: {
          created: 1,
          eventId:
            "evt_state_001"
        }
      }
    );
  }
);