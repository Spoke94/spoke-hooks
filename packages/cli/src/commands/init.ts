import {
  mkdir,
  writeFile
} from "node:fs/promises";

import { join } from "node:path";

import {
  DEFAULT_SPOKE_CONFIG
} from "@spokelabs/core";

export async function runInit(): Promise<void> {
  const projectRoot = process.cwd();

  const spokeDir = join(
    projectRoot,
    ".spoke"
  );

  const configPath = join(
    spokeDir,
    "config.json"
  );

  const eventsDir = join(
    projectRoot,
    DEFAULT_SPOKE_CONFIG.eventsDir
  );

  await mkdir(
    spokeDir,
    {
      recursive: true
    }
  );

  const configContent =
    `${JSON.stringify(DEFAULT_SPOKE_CONFIG, null, 2)}\n`;

  try {
    await writeFile(
      configPath,
      configContent,
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
        `Spoke Hooks is already initialized: ${configPath}`
      );

      process.exitCode = 1;
      return;
    }

    throw error;
  }

  await mkdir(
    eventsDir,
    {
      recursive: true
    }
  );

  console.log("Spoke Hooks initialized.");
  console.log(`Config: ${configPath}`);
  console.log(`Events: ${eventsDir}`);
}