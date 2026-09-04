#!/usr/bin/env node

import { runBaseline } from "./commands/baseline.js";
import { runTest } from "./commands/test.js";
import { ReplayRequestError } from "@spokelabs/core";

const args = process.argv.slice(2);
const command = args[0];
try {
  if (command === "--version") {
    console.log("0.0.1");
  } else if (command === "baseline") {
    await runBaseline();
  } else if (command === "test") {
    await runTest();
  } else {
    console.log("Spoke Hooks");
    console.log("");
    console.log("Usage:");
    console.log("  spoke-hooks baseline");
    console.log("  spoke-hooks test");
    console.log("  spoke-hooks --version");
  }
} catch (error) {
  if (error instanceof ReplayRequestError) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
