# Spoke Hooks

**Your production webhooks are your best test suite.**

Spoke Hooks replays real webhook events against your application and catches behavioral regressions before they reach production.

It is built for developers who want webhook regressions to fail in CI, not in production.

## Install

Install Spoke Hooks as a development dependency:

```bash
npm install -D @spoke-labs/hooks
```

Initialize it in your project:

```bash
npx spoke-hooks init
```

This creates:

```text
.spoke/
├── config.json
└── events/
```

Add a Stripe event:

```bash
npx spoke-hooks add stripe-event.json
```

Run your webhook application in a known-good state and record its behavior:

```bash
npx spoke-hooks baseline
```

After changing your application code, replay the same events:

```bash
npx spoke-hooks test
```

If the behavior changes, Spoke Hooks exits with status code `1`, making the same command usable directly in CI.

## Why

Webhook integrations are easy to break.

A handler can still compile, unit tests can still pass, and synthetic test payloads can still look correct while a real webhook event behaves differently.

Real webhook traffic contains edge cases that synthetic fixtures often miss:

- unexpected optional fields
- real provider payload shapes
- historical event variations
- duplicate delivery behavior
- delayed events
- ordering differences

Spoke Hooks turns real webhook events into regression tests.

## Core idea

The workflow is intentionally simple:

```text
real webhook event
        ↓
safe local fixture
        ↓
record known-good behavior
        ↓
change application code
        ↓
replay same event
        ↓
compare behavior
        ↓
PASS / FAIL
```

The goal is to make webhook behavior testable in the same way developers already test code changes in CI.

## Quick start

### 1. Initialize Spoke Hooks

From the root of your application:

```bash
npx spoke-hooks init
```

Default configuration:

```json
{
  "endpoint": "http://localhost:3000/webhook",
  "eventsDir": ".spoke/events",
  "timeoutMs": 5000
}
```

Edit `.spoke/config.json` if your webhook endpoint or timeout is different.

If your Stripe webhook handler verifies webhook signatures, enable signed replay by referencing the environment variable that contains your local or test webhook secret:

```json
{
  "endpoint": "http://localhost:3000/webhook",
  "eventsDir": ".spoke/events",
  "timeoutMs": 5000,
  "replay": {
    "webhookSecretEnv": "STRIPE_WEBHOOK_SECRET"
  }
}
```

Then provide the secret when running Spoke Hooks:

```bash
export STRIPE_WEBHOOK_SECRET=whsec_...
```

The secret itself is not stored in the fixture or `.spoke/config.json`.

If you also want to verify application side effects after each replay, configure an optional generic assertion command:

```json
{
  "endpoint": "http://localhost:3000/webhook",
  "eventsDir": ".spoke/events",
  "timeoutMs": 5000,
  "assertion": {
    "command": "node",
    "args": ["scripts/spoke-state.mjs"],
    "timeoutMs": 5000
  }
}
```

The command can inspect whatever state matters to your application and must write one valid JSON value to stdout. Spoke Hooks stores that value in the baseline and compares it exactly during `test`.

### 2. Add a Stripe event

Given a Stripe event such as:

```json
{
  "id": "evt_invoice_paid_001",
  "type": "invoice.paid",
  "data": {
    "object": {
      "id": "in_001",
      "status": "paid"
    }
  }
}
```

Import it:

```bash
npx spoke-hooks add stripe-event.json
```

Before writing the fixture, Spoke Hooks redacts supported Stripe customer PII fields in memory and previews the exact fixture that will be stored.

Confirm the write when prompted:

```text
Write this fixture? [y/N]
```

For non-interactive workflows:

```bash
npx spoke-hooks add stripe-event.json --yes
```

The raw input event is not persisted by `add`. Redaction is intentionally context-aware and currently covers common customer PII such as names, email addresses, phone numbers, and addresses in known Stripe customer, billing, receipt, and shipping contexts. It does not claim to detect arbitrary sensitive data in every custom field.

Spoke Hooks stores the redacted fixture under:

```text
.spoke/events/
```

At this point no expected behavior has been recorded yet.

Running:

```bash
npx spoke-hooks test
```

will fail with:

```text
Event: invoice.paid
FAIL: No baseline recorded. Run `spoke-hooks baseline` first.
```

and exit with status code:

```text
1
```

### 3. Record a baseline

Start your application in a known-good state.

Then run:

```bash
npx spoke-hooks baseline
```

Spoke Hooks sends the stored webhook payload to the configured endpoint and records the response.

If a side-effect assertion command is configured, Spoke Hooks runs it after the replay and records the returned JSON state in the same baseline.

If signature-preserving replay is enabled, Spoke Hooks generates a fresh Stripe signature for the exact serialized request body before sending it.

Example:

```text
Event: invoice.paid
Baseline updated:
{ status: 200, body: { received: true } }
```

The fixture now contains the known-good behavior:

```json
{
  "event": {
    "id": "evt_invoice_paid_001",
    "provider": "stripe",
    "type": "invoice.paid",
    "payload": {
      "id": "evt_invoice_paid_001",
      "type": "invoice.paid",
      "data": {
        "object": {
          "id": "in_001",
          "status": "paid"
        }
      }
    }
  },
  "baseline": {
    "status": 200,
    "body": {
      "received": true
    }
  }
}
```

With a configured side-effect assertion, the same baseline can also include application state:

```json
{
  "baseline": {
    "status": 200,
    "body": {
      "received": true
    },
    "state": {
      "subscriptionStatus": "active",
      "processedCount": 1
    }
  }
}
```

### 4. Change your application

Make changes to your webhook handler as usual.

Your stored event and its known-good baseline stay unchanged.

### 5. Test for regressions

Run:

```bash
npx spoke-hooks test
```

If the current application behaves like the recorded baseline:

```text
Event: invoice.paid
Expected: { status: 200, body: { received: true } }
Actual: { status: 200, body: { received: true } }
PASS
```

Exit code:

```text
0
```

If a code change introduces a regression:

```text
Event: invoice.paid
Expected: { status: 200, body: { received: true } }
Actual: { status: 500, body: { received: true } }
FAIL
```

Exit code:

```text
1
```

That non-zero exit code causes CI jobs to fail.

When a side-effect assertion is configured, both the HTTP result and returned state must match the recorded baseline. A state mismatch also produces `FAIL` and exit code `1`.

## Stripe signature-preserving replay

Stripe webhook handlers commonly verify the `Stripe-Signature` header against the exact raw request body. Disabling that verification during regression tests would skip part of the real webhook path.

Spoke Hooks can generate a fresh Stripe signature on every replay while leaving verification enabled in the application under test.

Enable it in `.spoke/config.json`:

```json
{
  "endpoint": "http://localhost:3000/webhook",
  "eventsDir": ".spoke/events",
  "timeoutMs": 5000,
  "replay": {
    "webhookSecretEnv": "STRIPE_WEBHOOK_SECRET"
  }
}
```

Set the referenced environment variable:

```bash
export STRIPE_WEBHOOK_SECRET=whsec_...
```

Then use the normal commands:

```bash
npx spoke-hooks baseline
npx spoke-hooks test
```

During each signed replay, Spoke Hooks:

1. serializes the stored fixture payload once
2. generates a fresh Stripe signature for that exact body
3. sends the exact same body and signature to the configured webhook endpoint

This preserves the important invariant:

```text
stored fixture payload
        ↓
serialize once
        ↓
same body ─────→ Stripe signature
        │
        └──────→ HTTP request body
```

Spoke Hooks does **not** store the webhook secret in fixtures or configuration. `.spoke/config.json` stores only the environment variable name.

Existing configurations without a `replay` section remain valid and continue to use unsigned replay.

If signing is configured but the referenced environment variable is missing, Spoke Hooks exits with a non-zero status before sending the request:

```text
ERROR: Webhook signing is configured, but environment variable STRIPE_WEBHOOK_SECRET is not set.
```

Your webhook application still needs to verify Stripe signatures correctly using its raw request body.

For Express, that normally means the webhook route must receive the raw body instead of a body that has already been parsed and re-serialized.

Example:

```ts
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (request, response) => {
    const signature =
      request.headers["stripe-signature"];

    const event =
      stripe.webhooks.constructEvent(
        request.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

    response.status(200).json({
      received: true
    });
  }
);
```

## Generic side-effect assertions

An HTTP `200` response does not always mean the webhook produced the correct application state. A handler can return successfully while writing the wrong row, applying an effect twice, skipping a state transition, or producing an incorrect derived value.

Spoke Hooks supports an optional provider-agnostic assertion command that runs after each replay and returns the state you want to regression-test.

Configure it in `.spoke/config.json`:

```json
{
  "endpoint": "http://localhost:3000/webhook",
  "eventsDir": ".spoke/events",
  "timeoutMs": 5000,
  "assertion": {
    "command": "node",
    "args": ["scripts/spoke-state.mjs"],
    "timeoutMs": 5000
  }
}
```

The command and arguments are passed separately. Spoke Hooks does not invoke the assertion through a shell.

The assertion command:

- runs from the project root
- inherits the current environment
- receives `SPOKE_EVENT_ID`
- receives `SPOKE_EVENT_PROVIDER`
- receives `SPOKE_EVENT_TYPE`
- must write exactly one valid JSON value to stdout
- can write diagnostic messages to stderr

For example, a project-defined script might read application state and return a structured snapshot:

```js
import { readFile } from "node:fs/promises";

const state = JSON.parse(
  await readFile("test-state.json", "utf8")
);

console.log(
  JSON.stringify({
    eventId: process.env.SPOKE_EVENT_ID,
    subscriptionStatus: state.subscriptionStatus,
    processedCount: state.processedCount
  })
);
```

The storage or application mechanism is intentionally outside Spoke Hooks. The script can query PostgreSQL, Redis, MongoDB, an internal API, a queue-derived projection, a local file, or any other project-specific source. Spoke Hooks only executes the command, captures its JSON result, and compares that result against the recorded baseline.

The workflow is:

```text
webhook replay
      ↓
HTTP result
      +
assertion command
      ↓
JSON state
      ↓
baseline / exact comparison
      ↓
PASS / FAIL
```

During `baseline`, the assertion result is stored under `baseline.state`:

```json
{
  "baseline": {
    "status": 200,
    "body": {
      "received": true
    },
    "state": {
      "subscriptionStatus": "active",
      "processedCount": 1
    }
  }
}
```

During `test`, Spoke Hooks runs the assertion again and performs exact deep comparison against the recorded state. Values are not normalized or coerced, so `1` and `"1"` are different and array order remains significant.

If assertion configuration is added to a project but an existing fixture does not contain `baseline.state`, `spoke-hooks test` fails before sending the webhook request:

```text
FAIL: No assertion state baseline recorded. Run `spoke-hooks baseline` first.
```

Assertion command failures also fail the CLI with exit code `1`, including:

- command start failures
- non-zero exit codes
- empty stdout
- invalid JSON output
- assertion timeouts

Example:

```text
ERROR: Assertion command exited with code 9: assertion failed
```

Assertion output becomes part of the stored fixture baseline. Do not return secrets, credentials, tokens, raw sensitive customer data, or other values that should not be committed to the repository.

This first assertion mechanism is deliberately small. It does not include database-specific adapters, queue-specific integrations, state normalization, condition polling, or duplicate-delivery orchestration.

## CLI

Current V0 commands:

```bash
npx spoke-hooks init
npx spoke-hooks add <event.json>
npx spoke-hooks baseline
npx spoke-hooks test
npx spoke-hooks --version
```

### `init`

Creates the Spoke Hooks project structure:

```bash
npx spoke-hooks init
```

Creates:

```text
.spoke/config.json
.spoke/events/
```

### `add`

Imports a Stripe event into the fixture corpus:

```bash
npx spoke-hooks add stripe-event.json
```

The command redacts supported Stripe customer PII before anything is written, previews the exact stored fixture, and asks for confirmation.

Use `--yes` to skip the interactive confirmation:

```bash
npx spoke-hooks add stripe-event.json --yes
```

Spoke Hooks refuses to silently overwrite an existing fixture.

### `baseline`

Replays every stored fixture against the configured webhook endpoint and records the current response as expected behavior. If a side-effect assertion is configured, its JSON result is recorded as `baseline.state` as well:

```bash
npx spoke-hooks baseline
```

Use this while your application is in a known-good state.

If signed replay is configured, the request is signed with a fresh Stripe signature using the configured environment variable.

### `test`

Replays the stored fixtures without changing their baselines:

```bash
npx spoke-hooks test
```

The current response is compared against the recorded response. If a side-effect assertion is configured, the current assertion state is also compared exactly against `baseline.state`.

A difference in either HTTP behavior or assertion state produces:

```text
FAIL
```

and exit code `1`.

### `--version`

Prints the installed CLI version:

```bash
npx spoke-hooks --version
```

Unknown commands also exit with a non-zero status.

## What is compared

Current V0 regression checks compare:

- HTTP response status
- response body
- optional side-effect assertion state using exact deep comparison

Spoke Hooks also treats runtime replay or assertion failures as test failures, including:

- endpoint connection failures
- request timeouts
- missing configured webhook signing secrets
- assertion command start failures
- assertion command non-zero exits
- assertion command timeouts
- empty assertion output
- invalid assertion JSON

Signature verification failures returned by the application are normal HTTP behavior and are therefore visible in the regression result. For example, a handler that rejects an invalid signature with HTTP `400` will differ from a baseline that expects HTTP `200`.

## Error handling

### Endpoint unavailable

If the webhook server is not running:

```text
ERROR: Could not connect to webhook endpoint: http://localhost:3000/webhook
```

Exit code:

```text
1
```

### Request timeout

If the webhook handler does not respond before the configured timeout:

```text
ERROR: Webhook request timed out after 5000 ms: http://localhost:3000/webhook
```

Exit code:

```text
1
```

### Missing webhook secret

If signed replay is enabled but its environment variable is not set:

```text
ERROR: Webhook signing is configured, but environment variable STRIPE_WEBHOOK_SECRET is not set.
```

Exit code:

```text
1
```

### Assertion command failure

If a configured assertion command cannot produce a valid state snapshot, Spoke Hooks exits with status code `1`.

For example:

```text
ERROR: Assertion command exited with code 9: assertion failed
```

Timeouts, command start failures, empty stdout, and invalid JSON are reported as assertion errors as well.

## Configuration

Spoke Hooks reads configuration from:

```text
.spoke/config.json
```

Default configuration:

```json
{
  "endpoint": "http://localhost:3000/webhook",
  "eventsDir": ".spoke/events",
  "timeoutMs": 5000
}
```

### `endpoint`

The local webhook endpoint Spoke Hooks should replay events against.

Example:

```json
{
  "endpoint": "http://localhost:3000/webhook"
}
```

### `eventsDir`

Directory containing webhook fixtures.

Default:

```text
.spoke/events
```

### `timeoutMs`

Maximum time Spoke Hooks waits for the webhook endpoint to respond.

Default:

```text
5000
```

### `replay.webhookSecretEnv`

Optional environment-variable name used for signed webhook replay.

Example:

```json
{
  "replay": {
    "webhookSecretEnv": "STRIPE_WEBHOOK_SECRET"
  }
}
```

The value is the **name** of the environment variable, not the secret itself.

With:

```bash
export STRIPE_WEBHOOK_SECRET=whsec_...
```

Spoke Hooks reads the secret at runtime and generates a fresh Stripe signature for each replay.

If the `replay` section is omitted, Spoke Hooks keeps the existing unsigned behavior.

### `assertion.command`

Optional executable used to capture project-defined side-effect state after each webhook replay.

Example:

```json
{
  "assertion": {
    "command": "node",
    "args": ["scripts/spoke-state.mjs"],
    "timeoutMs": 5000
  }
}
```

The command is executed directly rather than through a shell. It runs from the project root and must write one valid JSON value to stdout.

### `assertion.args`

Optional array of arguments passed directly to the assertion command.

Example:

```json
{
  "assertion": {
    "command": "node",
    "args": ["scripts/spoke-state.mjs", "--mode", "test"]
  }
}
```

### `assertion.timeoutMs`

Optional timeout for the assertion command. If omitted, Spoke Hooks uses its assertion-command default timeout.

A timeout is treated as a test failure.

If the entire `assertion` section is omitted, Spoke Hooks keeps the existing HTTP-only baseline and test behavior.

## GitHub Actions

Spoke Hooks is designed to work as a normal CI command.

Once your application is running inside the CI job, run:

```yaml
- name: Run webhook regression tests
  run: npx spoke-hooks test
```

A webhook regression causes the command to exit with status code `1`, which fails the GitHub Actions step.

Your `.spoke/events` fixtures and recorded baselines can live in the repository alongside the application code.

If signed Stripe replay is enabled, provide the webhook secret through your CI secret store rather than committing it:

```yaml
- name: Run webhook regression tests
  env:
    STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
  run: npx spoke-hooks test
```

## Current V0 scope

The current version intentionally focuses on a narrow workflow:

- Stripe
- Node.js applications
- Express-compatible HTTP endpoints
- JSON event fixtures
- context-aware redaction of common Stripe customer PII during `add`
- local HTTP replay
- optional Stripe signature-preserving replay
- baseline recording
- HTTP status comparison
- response body comparison
- optional generic command-based side-effect assertions
- exact side-effect state comparison
- timeout handling
- connection error handling
- CI-friendly exit codes
- GitHub Actions usage

The narrow scope is intentional.

Spoke Hooks is currently not:

- a webhook delivery platform
- a webhook forwarding proxy
- a hosted dashboard
- a production webhook gateway
- a replacement for Stripe's developer tooling
- a multi-provider webhook platform
- a database-specific assertion framework
- a queue-specific integration framework

The current goal is one thing:

**turn webhook events that already happened into regression tests for the code you are changing today.**

## Repository structure

```text
spoke-hooks/
├── .github/
│   └── workflows/
│       └── m0.yml
├── examples/
│   └── express-stripe/
├── packages/
│   ├── cli/
│   ├── core/
│   └── stripe/
├── package.json
├── tsconfig.json
└── README.md
```

### `@spoke-labs/hooks`

User-facing CLI package.

Provides:

```text
spoke-hooks
```

### `@spoke-labs/core`

Core fixture, replay, configuration, discovery, comparison, assertion-command execution, and shared type functionality.

It remains provider-agnostic. Provider-specific signing logic and project-specific state inspection live outside core.

### `@spoke-labs/stripe`

Stripe-specific functionality, including:

- Stripe event import support
- context-aware fixture redaction
- Stripe signature generation
- Stripe replay request construction

Users normally only need to install:

```bash
npm install -D @spoke-labs/hooks
```

The internal packages are installed automatically as dependencies.

## Development

Clone the repository and install workspace dependencies:

```bash
npm install
```

Build all packages:

```bash
npm run build
```

Run TypeScript checks:

```bash
npm run typecheck
```

Run the test suite:

```bash
npm test
```

The current regression suite covers the generic replay layer, configuration parsing, CLI signing configuration, assertion command execution, assertion-state comparison, baseline state capture, CLI assertion pass/fail behavior, Stripe redaction, Stripe signature generation, Stripe replay construction, and end-to-end replay through real Stripe signature verification.

## Status

Spoke Hooks is currently an early V0 focused on validating the webhook regression testing workflow.

The product surface is intentionally small while the core behavior is being validated with real developer usage.

## License

License information will be added before a stable release.