import {
  compareReplayResult,
  loadFixture,
  replayFixture
} from "@spokelabs/core";

export async function runTest(): Promise<void> {
  const fixture = await loadFixture(
    "./examples/express-stripe/.spoke/events/invoice-paid.json"
  );

  const actual = await replayFixture(
    fixture,
    "http://localhost:3000/webhook"
  );

  const comparison = compareReplayResult(
    fixture.baseline,
    actual
  );

  console.log("Expected:", fixture.baseline);
  console.log("Actual:", actual);

  if (comparison.passed) {
    console.log("PASS");
  } else {
    console.error("FAIL");
    process.exitCode = 1;
  }
}
