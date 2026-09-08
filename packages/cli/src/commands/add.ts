import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";

import {
  join,
  resolve,
} from "node:path";

import {
  loadConfig
} from "@spokelabs/core";


import {
  createStripeFixture
} from "@spokelabs/stripe";

export async function runAdd(
  inputPath: string | undefined
): Promise<void> {
  if (!inputPath) {
    console.error(
      "Usage: spoke-hooks add <event.json>"
    );

    process.exitCode = 1;
    return;
  }

  const projectRoot = process.cwd();

  const config = await loadConfig(
    projectRoot
  );

  const sourcePath = resolve(
    projectRoot,
    inputPath
  );

  const content = await readFile(
    sourcePath,
    "utf8"
  );

  const parsed: unknown = JSON.parse(
    content
  );

  const fixture = createStripeFixture(
    parsed
  );

  const eventsDir = join(
    projectRoot,
    config.eventsDir
  );

  await mkdir(
    eventsDir,
    {
      recursive: true
    }
  );

  const safeType = sanitizeFilePart(
    fixture.event.type
  );

  const safeId = sanitizeFilePart(
    fixture.event.id
  );

  const fixturePath = join(
    eventsDir,
    `${safeType}-${safeId}.json`
  );

  const fixtureContent =
    `${JSON.stringify(fixture, null, 2)}\n`;

  try {
    await writeFile(
      fixturePath,
      fixtureContent,
      {
        encoding: "utf8",
        flag: "wx"
      }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      console.error(
        `Fixture already exists: ${fixturePath}`
      );

      process.exitCode = 1;
      return;
    }

    throw error;
  }

  console.log(
    `Added Stripe event: ${fixture.event.type}`
  );

  console.log(
    `Fixture: ${fixturePath}`
  );

  console.log(
    "Run `spoke-hooks baseline` to record expected behavior."
  );
}

function sanitizeFilePart(
  value: string
): string {
  return value.replace(
    /[^a-zA-Z0-9._-]/g,
    "-"
  );
}