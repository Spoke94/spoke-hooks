#!/usr/bin/env node

import { ReplayRequestError } from "@spokelabs/core";

import { runAdd } from "./commands/add.js";
import { runBaseline } from "./commands/baseline.js";
import { runInit } from "./commands/init.js";
import { runTest } from "./commands/test.js";

const args = process.argv.slice(2);
const command = args[0];
try {
  if (command === "--version") {
    console.log("0.0.1");
  } else if (command === "init") {
    await runInit();
  } else if (command === "add") {
    await runAdd(args[1]);
  }else if (command === "baseline") {
    await runBaseline();
  } else if (command === "test") {
    await runTest();
  } else {
    console.log("Spoke Hooks");
    console.log("");
    console.log("Usage:");
    console.log("  spoke-hooks init");
    console.log("  spoke-hooks add <event.json>");
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
