import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function listFixturePaths(
  eventsDir: string
): Promise<string[]> {
  const entries = await readdir(
    eventsDir,
    {
        withFileTypes: true
    }
  );

  return entries
    .filter((entry) => {
      return (
        entry.isFile() &&
        entry.name.endsWith(".json")
      );
    })
    .map((entry) => {
      return join(
        eventsDir,
        entry.name
      );
    })
    .sort();
}