import { join } from "node:path";

import {
  compareAssertionState,
  compareReplayResult,
  listFixturePaths,
  loadConfig,
  loadFixture
} from "@spoke-labs/core";

import {
  captureObservation
} from "../observation.js";

export async function runTest(): Promise<void> {
  const projectRoot = process.cwd();

  const config =
    await loadConfig(
      projectRoot
    );

  const eventsDir =
    join(
      projectRoot,
      config.eventsDir
    );

  const fixturePaths =
    await listFixturePaths(
      eventsDir
    );

  let hasFailure = false;

  for (const fixturePath of fixturePaths) {
    const fixture =
      await loadFixture(
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

    const sequentialCount =
      config.duplicates?.sequential ?? 0;

    const sequentialDuplicates =
      fixture.baseline.sequentialDuplicates ?? [];

    if (
      sequentialDuplicates.length !==
      sequentialCount
    ) {
      console.error("");
      console.error(
        `Event: ${fixture.event.type}`
      );
      console.error(
        "FAIL: Sequential duplicate baseline does not match the configured replay count. Run `spoke-hooks baseline` first."
      );

      hasFailure = true;
      continue;
    }

    if (
      config.assertion !== undefined &&
      sequentialDuplicates.some(
        (observation) =>
          !Object.prototype.hasOwnProperty.call(
            observation,
            "state"
          )
      )
    ) {
      console.error("");
      console.error(
        `Event: ${fixture.event.type}`
      );
      console.error(
        "FAIL: No assertion state baseline recorded for a sequential duplicate. Run `spoke-hooks baseline` first."
      );

      hasFailure = true;
      continue;
    }

    const actual =
      await captureObservation(
        fixture,
        config,
        projectRoot
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
        actual.state
      );

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
      actual
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

    for (
      let duplicateIndex = 0;
      duplicateIndex <
      sequentialDuplicates.length;
      duplicateIndex += 1
    ) {
      const expectedDuplicate =
        sequentialDuplicates[
          duplicateIndex
        ];

      const actualDuplicate =
        await captureObservation(
          fixture,
          config,
          projectRoot
        );

      const duplicateComparison =
        compareReplayResult(
          expectedDuplicate,
          actualDuplicate
        );

      const duplicateStateMatches =
        config.assertion === undefined ||
        compareAssertionState(
          expectedDuplicate.state,
          actualDuplicate.state
        );

      console.log("");
      console.log(
        `Event: ${fixture.event.type}`
      );
      console.log(
        `Sequential duplicate #${duplicateIndex + 1}`
      );
      console.log(
        "Expected:",
        expectedDuplicate
      );
      console.log(
        "Actual:",
        actualDuplicate
      );

      if (
        duplicateComparison.passed &&
        duplicateStateMatches
      ) {
        console.log("PASS");
      } else {
        console.error("FAIL");

        if (!duplicateStateMatches) {
          console.error(
            "Assertion state does not match the recorded baseline."
          );
        }

        hasFailure = true;
      }
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}
