import test from "node:test";
import assert from "node:assert/strict";

import {
  execFileSync
} from "node:child_process";

import {
  readFileSync
} from "node:fs";

import {
  fileURLToPath
} from "node:url";

test(
  "CLI --version matches package version",
  () => {
    const packageJson = JSON.parse(
      readFileSync(
        new URL(
          "../package.json",
          import.meta.url
        ),
        "utf8"
      )
    );

    const cliPath =
      fileURLToPath(
        new URL(
          "../dist/index.js",
          import.meta.url
        )
      );

    const version =
      execFileSync(
        process.execPath,
        [
          cliPath,
          "--version"
        ],
        {
          encoding: "utf8"
        }
      ).trim();

    assert.equal(
      version,
      packageJson.version
    );
  }
);