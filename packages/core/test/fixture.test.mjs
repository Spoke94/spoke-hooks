import test from "node:test";
import assert from "node:assert/strict";

import {
  mkdtemp,
  rm,
  writeFile
} from "node:fs/promises";

import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  loadFixture
} from "../dist/index.js";

async function writeFixture(
  fixture
) {
  const projectRoot =
    await mkdtemp(
      join(
        tmpdir(),
        "spoke-fixture-test-"
      )
    );

  const fixturePath =
    join(
      projectRoot,
      "event.json"
    );

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

function createFixture(
  baseline
) {
  return {
    event: {
      id: "evt_duplicate_001",
      provider: "test-provider",
      type: "test.event",
      payload: {
        id: "evt_duplicate_001"
      }
    },
    baseline
  };
}

test(
  "loads a fixture with sequential duplicate observations",
  async (t) => {
    const fixture =
      createFixture({
        status: 200,
        body: {
          primary: true
        },
        state: {
          count: 1
        },
        sequentialDuplicates: [
          {
            status: 200,
            body: {
              duplicate: true
            },
            state: {
              count: 1
            }
          }
        ]
      });

    const project =
      await writeFixture(
        fixture
      );

    t.after(
      async () => {
        await rm(
          project.projectRoot,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    const loaded =
      await loadFixture(
        project.fixturePath
      );

    assert.deepEqual(
      loaded,
      fixture
    );
  }
);

test(
  "rejects malformed sequential duplicate observations",
  async (t) => {
    const invalidBaselines = [
      {
        status: 200,
        body: {},
        sequentialDuplicates: {}
      },
      {
        status: 200,
        body: {},
        sequentialDuplicates: [
          {
            status: 200
          }
        ]
      },
      {
        status: 200,
        body: {},
        sequentialDuplicates: [
          {
            status: "200",
            body: {}
          }
        ]
      }
    ];

    const projects = [];

    t.after(
      async () => {
        for (const project of projects) {
          await rm(
            project.projectRoot,
            {
              recursive: true,
              force: true
            }
          );
        }
      }
    );

    for (const baseline of invalidBaselines) {
      const project =
        await writeFixture(
          createFixture(
            baseline
          )
        );

      projects.push(
        project
      );

      await assert.rejects(
        loadFixture(
          project.fixturePath
        ),
        /Invalid webhook fixture/
      );
    }
  }
);
