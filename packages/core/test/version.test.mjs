import test from "node:test";
import assert from "node:assert/strict";

import {
  readFileSync
} from "node:fs";

import {
  CORE_VERSION
} from "../dist/index.js";

test(
  "CORE_VERSION matches package version",
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

    assert.equal(
      CORE_VERSION,
      packageJson.version
    );
  }
);