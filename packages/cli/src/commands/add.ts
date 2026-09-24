import {
  createInterface
} from "node:readline/promises";

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
} from "@spoke-labs/core";

import {
  createStripeFixture,
  redactStripeEvent
} from "@spoke-labs/stripe";

type AddOptions = {
  yes?: boolean;
};

export async function runAdd(
  inputPath: string | undefined,
  options: AddOptions = {}
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

  const redacted = redactStripeEvent(
    parsed
  );

  const fixture = createStripeFixture(
    redacted
  );

  const eventsDir = join(
    projectRoot,
    config.eventsDir
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

  console.log(
    "Spoke Hooks will store:"
  );

  console.log("");

  console.log(
    fixtureContent.trimEnd()
  );

  console.log("");

  if (!options.yes) {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    let answer: string;

    try {
      answer = await readline.question(
        "Save this fixture? [y/N] "
      );
    } finally {
      readline.close();
    }

    const confirmed =
      answer.trim().toLowerCase() === "y" ||
      answer.trim().toLowerCase() === "yes";

    if (!confirmed) {
      console.log(
        "Cancelled. No fixture was written."
      );

      return;
    }
  }

  await mkdir(
    eventsDir,
    {
      recursive: true
    }
  );

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