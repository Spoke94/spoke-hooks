import {
  execFile
} from "node:child_process";

import type {
  AssertionConfig
} from "./config.js";

import type {
  WebhookFixture
} from "./types.js";

const DEFAULT_ASSERTION_TIMEOUT_MS = 5000;

export class AssertionCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionCommandError";
  }
}

export async function runAssertionCommand(
  config: AssertionConfig,
  projectRoot: string,
  fixture: WebhookFixture,
  environment: NodeJS.ProcessEnv = process.env
): Promise<unknown> {
  const timeoutMs =
    config.timeoutMs ??
    DEFAULT_ASSERTION_TIMEOUT_MS;

  return new Promise(
    (resolve, reject) => {
      execFile(
        config.command,
        config.args ?? [],
        {
          cwd: projectRoot,
          env: {
            ...environment,
            SPOKE_EVENT_ID:
              fixture.event.id,
            SPOKE_EVENT_PROVIDER:
              fixture.event.provider,
            SPOKE_EVENT_TYPE:
              fixture.event.type
          },
          timeout: timeoutMs,
          encoding: "utf8"
        },
        (
          error,
          stdout,
          stderr
        ) => {
          if (error !== null) {
            if (error.killed) {
              reject(
                new AssertionCommandError(
                  `Assertion command timed out after ${timeoutMs}ms.`
                )
              );
              return;
            }

            const details =
              stderr.trim();

            if (
              typeof error.code === "string"
            ) {
              reject(
                new AssertionCommandError(
                  `Assertion command failed to start: ${error.message}`
                )
              );
              return;
            }

            reject(
              new AssertionCommandError(
                `Assertion command exited with code ${error.code ?? "unknown"}${
                  details.length > 0
                    ? `: ${details}`
                    : "."
                }`
              )
            );
            return;
          }

          const output =
            stdout.trim();

          if (output.length === 0) {
            reject(
              new AssertionCommandError(
                "Assertion command returned empty output."
              )
            );
            return;
          }

          try {
            resolve(
              JSON.parse(output)
            );
          } catch {
            reject(
              new AssertionCommandError(
                "Assertion command returned invalid JSON."
              )
            );
          }
        }
      );
    }
  );
}