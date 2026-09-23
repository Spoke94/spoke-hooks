import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("unknown command exits with a non-zero status", () => {
  const result = spawnSync(
    process.execPath,
    ["packages/cli/dist/index.js", "tes"],
    {
       encoding: "utf8"
    }
  );

  assert.notEqual(result.status, 0);
});
