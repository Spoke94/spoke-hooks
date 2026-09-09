import { join } from "node:path";

import {
  listFixturePaths,
  loadConfig,
  loadFixture,
  replayFixture,
  saveFixture
} from "@spoke-labs/core";

export async function runBaseline(): Promise<void> {
  const projectRoot = process.cwd();

  const config = await loadConfig(projectRoot);

  const eventsDir = join(
    projectRoot,
    config.eventsDir
  );

  const fixturePaths = await listFixturePaths(
    eventsDir
  );

  for (const fixturePath of fixturePaths) {
    const fixture = await loadFixture(
      fixturePath
    );

    const actual = await replayFixture(
      fixture,
      config.endpoint,
      config.timeoutMs
    );

    fixture.baseline = actual;

    await saveFixture(
      fixturePath,
      fixture
    );

    console.log("");
    console.log(`Event: ${fixture.event.type}`);
    console.log("Baseline updated:");
    console.log(actual);
  }
}