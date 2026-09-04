# Spoke Hooks

Your production webhooks are your best test suite.

Spoke Hooks replays real webhook events against your application and catches behavioral regressions before they reach production.

It is built for developers who want webhook regressions to fail in CI, not in production.

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

## Current V0

The current proof of concept focuses on:

- Stripe
- Node.js
- Express
- local HTTP replay
- JSON fixtures
- baseline recording
- HTTP status comparison
- response body comparison
- timeout handling
- connection error handling
- CI-friendly exit codes
- GitHub Actions

This is intentionally narrow.

Spoke Hooks is not currently a webhook forwarding proxy, dashboard, delivery platform, or cloud service.

## Example

Given a stored Stripe event:

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

Spoke Hooks replays:

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

against your webhook endpoint.

If the current application still behaves like the baseline:

```text
Expected: { status: 200, body: { received: true } }
Actual: { status: 200, body: { received: true } }
PASS
```

If a code change introduces a regression:

```text
Expected: { status: 200, body: { received: true } }
Actual: { status: 500, body: { received: true } }
FAIL
```

Spoke Hooks exits with status code `1`, which causes CI to fail.

## CLI

Current M0 commands:

```bash
spoke-hooks baseline
spoke-hooks test
```

### Record a baseline

Run your application in a known-good state:

```bash
spoke-hooks baseline
```

Example output:

```text
Baseline updated:
{ status: 200, body: { received: true } }
```

This stores the current webhook behavior as the expected baseline.

### Test for regressions

After changing your application:

```bash
spoke-hooks test
```

If behavior matches:

```text
PASS
```

Exit code:

```text
0
```

If behavior changes:

```text
FAIL
```

Exit code:

```text
1
```

## Error handling

Spoke Hooks also handles common runtime failures.

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

If the webhook handler does not respond before the timeout:

```text
ERROR: Webhook request timed out after 5000 ms: http://localhost:3000/webhook
```

Exit code:

```text
1
```

## Repository structure

```text
spoke-hooks/
├── .github/
│   └── workflows/
│       └── m0.yml
├── examples/
│   └── express-stripe/
│       ├── .spoke/
│       │   └── events/
│       │       └── invoice-paid.json
│       └── src/
│           └── index.ts
├── packages/
│   ├── cli/
│   │   └── src/
│   ├── core/
│   │   └── src/
│   └── stripe/
│       └── src/
├── package.json
├── package-lock.json
├── tsconfig.base.json
└── tsconfig.json
```

## Development setup

Requirements:

- Node.js 20+
- npm

Install dependencies:

```bash
npm ci
```

Build all packages:

```bash
npm run build
```

Start the example Express webhook server:

```bash
node examples/express-stripe/dist/index.js
```

The example server listens on:

```text
http://localhost:3000
```

The webhook endpoint is:

```text
POST /webhook
```

## Local M0 flow

Start the example application:

```bash
node examples/express-stripe/dist/index.js
```

In another terminal, record the current behavior:

```bash
spoke-hooks baseline
```

Then modify the webhook handler and introduce a regression.

For example, change:

```ts
response.status(200).json({
  received: true
});
```

to:

```ts
response.status(500).json({
  received: true
});
```

Rebuild:

```bash
npm run build
```

Restart the application and run:

```bash
spoke-hooks test
```

Expected result:

```text
Expected: { status: 200, body: { received: true } }
Actual: { status: 500, body: { received: true } }
FAIL
```

## GitHub Actions

The repository includes a minimal GitHub Actions workflow.

On every push and pull request it:

1. checks out the repository
2. installs Node.js
3. installs dependencies
4. builds the project
5. starts the example webhook server
6. runs the Spoke Hooks regression test

If Spoke Hooks returns exit code `1`, the CI job fails.

This makes webhook regressions visible directly in the pull request workflow.

## Current limitations

M0 is intentionally minimal.

Current limitations include:

- one hardcoded fixture
- one hardcoded endpoint
- Stripe only
- no configuration file
- no automatic event import
- no fixture sanitization
- no multiple-event execution
- no detailed diff output
- no production capture pipeline
- no cloud backend
- no dashboard
- no billing

These are deliberate scope constraints for the first working version.

## Roadmap

Planned next steps:

- `spoke-hooks init`
- `spoke-hooks add`
- configurable webhook endpoint
- `.spoke/config.json`
- multiple fixture support
- multiple replay results in one run
- safer production-event sanitization
- richer body diffs
- provider-specific normalization
- better CLI reporting
- GitHub-native developer workflow

Longer-term direction:

```text
production webhook history
        ↓
safe local regression corpus
        ↓
code change
        ↓
automatic replay
        ↓
behavioral diff
        ↓
CI verdict
```

## Project status

Current milestone:

```text
M0 — One Event, One Regression
```

Completed proof:

```text
baseline 200
    ↓
intentional handler regression to 500
    ↓
spoke-hooks test
    ↓
FAIL
    ↓
exit 1
    ↓
GitHub Actions failure-compatible
```

The local flow and GitHub Actions integration are working.

## Philosophy

Spoke Hooks is being built around one principle:

> Your production webhooks are your best test suite.

Instead of inventing more synthetic webhook tests, reuse the events your system has already seen and verify that future code changes still handle them correctly.

---

Built by Spoke Labs.