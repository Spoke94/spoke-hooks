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
store as fixture
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

Spoke Hooks stores the event as a fixture under:

```text
.spoke/events/
```

The original Stripe payload is preserved inside the fixture.

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

Example output:

```text
Added Stripe event: invoice.payment_failed
Fixture: /path/to/project/.spoke/events/invoice.payment_failed-evt_123.json
Run `spoke-hooks baseline` to record expected behavior.
```

### `baseline`

Replays every stored fixture against the configured webhook endpoint and records the current response as expected behavior:

```bash
npx spoke-hooks baseline
```

Use this while your application is in a known-good state.

### `test`

Replays the stored fixtures without changing their baselines:

```bash
npx spoke-hooks test
```

The current response is compared against the recorded response.

A difference produces:

```text
FAIL
```

and exit code `1`.

### `--version`

Prints the installed CLI version:

```bash
npx spoke-hooks --version
```

## What is compared

Current V0 regression checks compare:

- HTTP response status
- response body

Spoke Hooks also treats runtime replay failures as test failures, including:

- endpoint connection failures
- request timeouts

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

## GitHub Actions

Spoke Hooks is designed to work as a normal CI command.

Once your application is running inside the CI job, run:

```yaml
- name: Run webhook regression tests
  run: npx spoke-hooks test
```

A webhook regression causes the command to exit with status code `1`, which fails the GitHub Actions step.

Your `.spoke/events` fixtures and recorded baselines can live in the repository alongside the application code.

## Current V0 scope

The current version intentionally focuses on a narrow workflow:

- Stripe
- Node.js applications
- Express-compatible HTTP endpoints
- JSON event fixtures
- local HTTP replay
- baseline recording
- HTTP status comparison
- response body comparison
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

Core fixture, replay, configuration, discovery, comparison, and shared type functionality.

### `@spoke-labs/stripe`

Stripe-specific event import and normalization functionality.

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

## Status

Spoke Hooks is currently an early V0 focused on validating the webhook regression testing workflow.

The product surface is intentionally small while the core behavior is being validated with real developer usage.

## License

License information will be added before a stable release.