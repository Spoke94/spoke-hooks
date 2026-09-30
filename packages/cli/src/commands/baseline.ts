import { join } from "node:path";

import {
  listFixturePaths,
  loadConfig,
  loadFixture,
  saveFixture
} from "@spoke-labs/core";

import type {
  WebhookObservation
} from "@spoke-labs/core";

import {
  captureObservation
} from "../observation.js";

export async function runBaseline(): Promise<void> {
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

  for (const fixturePath of fixturePaths) {
    const fixture =
      await loadFixture(
        fixturePath
      );

    const primary =
      await captureObservation(
        fixture,
        config,
        projectRoot
      );

    const sequentialDuplicates:
      WebhookObservation[] = [];

    const sequentialCount =
      config.duplicates?.sequential ?? 0;

    for (
      let duplicateIndex = 0;
      duplicateIndex < sequentialCount;
      duplicateIndex += 1
    ) {
      sequentialDuplicates.push(
        await captureObservation(
          fixture,
          config,
          projectRoot
        )
      );
    }

    const baseline =
      sequentialDuplicates.length === 0
        ? primary
        : {
          ...primary,
          sequentialDuplicates
        };

    fixture.baseline = baseline;

    await saveFixture(
      fixturePath,
      fixture
    );

    console.log("");
    console.log(
      `Event: ${fixture.event.type}`
    );
    console.log(
      "Baseline updated:"
    );
    console.log(
      baseline
    );
  }
}
