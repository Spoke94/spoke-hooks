import {
  loadFixture,
  replayFixture,
  saveFixture
} from "@spokelabs/core";

export async function runBaseline(): Promise<void> {
  const fixturePath =
    "./examples/express-stripe/.spoke/events/invoice-paid.json";

  const fixture = await loadFixture(fixturePath);

  const actual = await replayFixture(
    fixture,
    "http://localhost:3000/webhook"
  );

  fixture.baseline = actual;

  await saveFixture(
    fixturePath,
    fixture
  );

  console.log("Baseline updated:");
  console.log(actual);
}