import { join } from "node:path";

import {
  listFixturePaths,
  loadConfig,
  loadFixture,
  replayFixture,
  runAssertionCommand,
  saveFixture
} from "@spoke-labs/core";

import {
  createReplayRequestOptions
} from "../replay.js";

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

    const replayOptions =
      createReplayRequestOptions(
        fixture,
        config
      );

    const actual = await replayFixture(
      fixture,
      config.endpoint,
      config.timeoutMs,
      replayOptions
    );

    const baseline =
      config.assertion === undefined
        ? actual
        : {
          ...actual,
          state:
            await runAssertionCommand(
              config.assertion,
              projectRoot,
              fixture
            )
        };

    fixture.baseline = baseline;

    await saveFixture(
      fixturePath,
      fixture
    );

    console.log("");
    console.log(`Event: ${fixture.event.type}`);
    console.log("Baseline updated:");
    console.log(baseline);
  }
}
