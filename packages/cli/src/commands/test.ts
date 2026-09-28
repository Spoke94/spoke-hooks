import { join } from "node:path";

import {
  compareAssertionState,
  compareReplayResult,
  listFixturePaths,
  loadConfig,
  loadFixture,
  replayFixture,
  runAssertionCommand
} from "@spoke-labs/core";

import {
  createReplayRequestOptions
} from "../replay.js";

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

    if (fixture.baseline === null) {
      console.error("");
      console.error(
        `Event: ${fixture.event.type}`
      );
      console.error(
        "FAIL: No baseline recorded. Run `spoke-hooks baseline` first."
      );

      hasFailure = true;
      continue;
    }

    if (
      config.assertion !== undefined &&
      !Object.prototype.hasOwnProperty.call(
        fixture.baseline,
        "state"
      )
    ) {
      console.error("");
      console.error(
        `Event: ${fixture.event.type}`
      );
      console.error(
        "FAIL: No assertion state baseline recorded. Run `spoke-hooks baseline` first."
      );

      hasFailure = true;
      continue;
    }

    const replayOptions =
      createReplayRequestOptions(
        fixture,
        config
      );

    const actual =
      await replayFixture(
        fixture,
        config.endpoint,
        config.timeoutMs,
        replayOptions
      );

    const state =
      config.assertion === undefined
        ? undefined
        : await runAssertionCommand(
            config.assertion,
            projectRoot,
            fixture
          );

    const comparison =
      compareReplayResult(
        fixture.baseline,
        actual
      );

    const stateMatches =
      config.assertion === undefined ||
      compareAssertionState(
        fixture.baseline.state,
        state
      );

    const actualOutput =
      config.assertion === undefined
        ? actual
        : {
            ...actual,
            state
          };

    console.log("");
    console.log(
      `Event: ${fixture.event.type}`
    );
    console.log(
      "Expected:",
      fixture.baseline
    );
    console.log(
      "Actual:",
      actualOutput
    );

    if (
      comparison.passed &&
      stateMatches
    ) {
      console.log("PASS");
    } else {
      console.error("FAIL");

      if (!stateMatches) {
        console.error(
          "Assertion state does not match the recorded baseline."
        );
      }

      hasFailure = true;
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}