import { join } from "node:path";

import {
  compareReplayResult,
  listFixturePaths,
  loadConfig,
  loadFixture,
  replayFixture
} from "@spokelabs/core";

export async function runTest(): Promise<void> {
  const projectRoot = process.cwd();

  const config = await loadConfig(projectRoot);

  const eventsDir = join(
    projectRoot,
    config.eventsDir
  );

  const fixturePaths = await listFixturePaths(
    eventsDir
  );

  let hasFailure = false;

  for (const fixturePath of fixturePaths) {
    const fixture = await loadFixture(
      fixturePath
    );

    const actual = await replayFixture(
      fixture,
      config.endpoint,
      config.timeoutMs
    );

    const comparison = compareReplayResult(
      fixture.baseline,
      actual
    );

    console.log("");
    console.log(`Event: ${fixture.event.type}`);
    console.log("Expected:", fixture.baseline);
    console.log("Actual:", actual);

    if (comparison.passed) {
      console.log("PASS");
    } else {
      console.error("FAIL");
      hasFailure = true;
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}