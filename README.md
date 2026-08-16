# Cross-Chain Liquidity Reconciliation Engine

A deterministic, replayable security middleware for reconciling asynchronous liquidity state across Ethereum, Base, and Arbitrum.

The engine validates liquidity events, maintains per-chain state, detects stale and duplicate updates, enforces a temporal liquidity invariant, resolves cross-chain state using deterministic rules, and produces an auditable reconciliation trail.

All blockchain activity is simulated through local JSON fixtures. No live blockchain interaction or external database is required.

---

## Features

* Event validation and normalization
* Ethereum, Base, and Arbitrum support
* Per-token-pair, per-chain liquidity state
* Idempotent event processing
* Duplicate event detection
* Out-of-order and stale event handling
* Timestamp-based reconciliation
* Deterministic chain-of-trust resolution
* Temporal liquidity invariant enforcement
* Human-readable audit decisions
* JSONL audit trail
* Historical event replay
* Deterministic replay verification
* Local HTTP API
* CLI fixture runner
* Automated test suite

---

## Architecture

```text
                  Liquidity Events
                         │
              ┌──────────┴──────────┐
              │                     │
          HTTP API                 CLI
              │                     │
              └──────────┬──────────┘
                         ▼
                  Event Validation
                         │
                         ▼
                  Normalization
                         │
                         ▼
                  Reconciliation
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
        Idempotency   Temporal    State
                       Rules
                         │
                         ▼
                Conflict Resolution
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       Canonical State          Audit Trail
                                    │
                                    ▼
                                  Replay
```

---

## Technology

* TypeScript
* Node.js
* Vitest
* Local JSON fixtures
* In-memory state
* JSONL audit output

No external database or cloud service is required.

---

## Event Schema

Events follow the challenge specification:

```json
{
  "chain": "Arbitrum",
  "tokenA": "0x0000000000000000000000000000000000000001",
  "tokenB": "0x0000000000000000000000000000000000000002",
  "liquidity": "1500000000000000000",
  "timestamp": 1700000100,
  "source": "router",
  "event_id": "arb-001",
  "chain_id": 42161
}
```

### Fields

| Field       | Description                                          |
| ----------- | ---------------------------------------------------- |
| `chain`     | `Ethereum`, `Base`, or `Arbitrum`                    |
| `tokenA`    | First ERC20 token address                            |
| `tokenB`    | Second ERC20 token address                           |
| `liquidity` | Liquidity amount, represented internally as `bigint` |
| `timestamp` | Unix timestamp                                       |
| `source`    | `router`, `oracle`, or `bridge`                      |
| `event_id`  | Unique identifier used for idempotency               |
| `chain_id`  | Ethereum `1`, Base `8453`, Arbitrum `42161`          |

---

## Reconciliation Rules

The engine applies deterministic rules so that the same input and configuration always produce the same result.

### 1. Idempotency

Every `event_id` is processed at most once.

If the same event ID is submitted again:

```text
HTTP 409 Conflict
```

No state mutation occurs.

---

### 2. Timestamp Precedence

For the same chain and token pair:

```text
newer timestamp → accepted
older timestamp → stale update ignored
```

For example:

```text
Current:
liquidity = 2000
timestamp = 200

Incoming:
liquidity = 1000
timestamp = 100
```

The incoming event is ignored because it is older than the current state.

---

### 3. Chain of Trust

When competing states have the same timestamp, the configured chain trust order is:

```text
Arbitrum > Base > Ethereum
```

Therefore:

```text
same timestamp
       │
       ├── Ethereum
       ├── Base
       └── Arbitrum
                 ▲
                 │
              selected
```

Timestamp precedence is evaluated first. Chain trust is only used when timestamps are equal.

---

## Temporal Invariant

The engine enforces the following invariant:

> Liquidity for a given token pair must not decrease across chains over time without a corresponding on-chain event.

For the MVP implementation, a `router` event represents on-chain state-changing evidence.

Therefore:

```text
Previous liquidity:
1500

Oracle observation:
1000

Result:
LIQUIDITY_DECREASE_WITHOUT_ONCHAIN_EVENT
```

The established state is preserved.

A decrease backed by a router event is accepted:

```text
Previous:
1500

Router event:
1000

Result:
ACCEPTED_NEW_STATE
```

Increases from observation sources are allowed because the invariant specifically concerns unexplained decreases.

---

## Canonical State

The engine maintains separate state for each chain.

Example:

```text
USDC/WETH

Ethereum
  liquidity: 1000
  timestamp: 100

Base
  liquidity: 1200
  timestamp: 110

Arbitrum
  liquidity: 1500
  timestamp: 105
```

The canonical state is selected deterministically.

In this example:

```text
Base
timestamp: 110
liquidity: 1200
```

because its timestamp is newer than the other observations.

Cross-chain liquidity differences are not automatically treated as invalid. The engine preserves per-chain observations and uses deterministic reconciliation rules to select the canonical state.

---

## Audit Trail

Every reconciliation decision generates an audit record containing:

* `event_id`
* `decision`
* `reason`
* `timestamp`
* `state_before`
* `state_after`

Example:

```json
{
  "event_id": "oracle-001",
  "decision": "LIQUIDITY_DECREASE_WITHOUT_ONCHAIN_EVENT",
  "reason": "Liquidity decreased on Arbitrum from 1500 to 1000 without a router-sourced on-chain event.",
  "timestamp": 1700000200,
  "state_before": {},
  "state_after": {}
}
```

Audit records are also written as JSON Lines to:

```text
audit/audit.jsonl
```

---

## Replay

Historical events can be replayed in their original order.

The replay engine:

1. Loads the requested event IDs.
2. Resets the current reconciliation state.
3. Processes the events in the supplied order.
4. Reproduces state transitions.
5. Recreates the audit trail.

The replay tests verify that:

```text
Original State == Replayed State

Original Audit == Replayed Audit
```

This provides deterministic and reproducible state reconstruction.

---

## HTTP API

### `GET /health`

Returns service health.

```json
{
  "status": "ok"
}
```

---

### `GET /state`

Returns the current reconciled state.

```bash
curl http://localhost:3000/state
```

---

### `GET /audit`

Returns reconciliation audit records.

```bash
curl http://localhost:3000/audit
```

---

### `POST /events`

Processes a liquidity event.

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "Arbitrum",
    "tokenA": "0x0000000000000000000000000000000000000001",
    "tokenB": "0x0000000000000000000000000000000000000002",
    "liquidity": "1500000000000000000",
    "timestamp": 1700000100,
    "source": "router",
    "event_id": "arb-001",
    "chain_id": 42161
  }'
```

Responses:

```text
200 OK  → valid event processed
400     → malformed/invalid event
409     → duplicate event_id
```

---

### `POST /replay`

Replay a sequence of previously processed event IDs.

```bash
curl -X POST http://localhost:3000/replay \
  -H "Content-Type: application/json" \
  -d '{
    "event_ids": [
      "eth-001",
      "base-001",
      "arb-001"
    ]
  }'
```

---

## CLI

The same reconciliation engine can be executed against local fixtures.

### Ingest a fixture

```bash
npm run cli -- ingest fixtures/basic.json
```

### Replay a fixture

```bash
npm run cli -- replay fixtures/basic.json
```

The CLI prints reconciliation decisions, summary information, and the resulting canonical state.

---

## Fixtures

The `fixtures/` directory contains scenarios covering the main reconciliation edge cases:

```text
fixtures/
├── basic.json
├── duplicate.json
├── out-of-order.json
├── timestamp-conflict.json
├── unauthorized-decrease.json
├── legitimate-decrease.json
└── mixed.json
```

### Scenarios

* Basic multi-chain state updates
* Duplicate events
* Out-of-order timestamps
* Equal timestamp chain conflicts
* Unauthorized liquidity decreases
* Legitimate router-backed decreases
* Mixed interacting edge cases

`mixed.json` combines several of these conditions into a single replayable scenario.

---

## Project Structure

```text
cross-chain-liquidity-reconciliation-engine/
│
├── src/
│   ├── types.ts
│   ├── validation.ts
│   ├── state.ts
│   ├── reconciler.ts
│   ├── audit.ts
│   ├── replay.ts
│   ├── fixtures.ts
│   ├── server.ts
│   └── cli.ts
│
├── tests/
│   ├── helpers.ts
│   ├── validation.test.ts
│   ├── reconciliation.test.ts
│   ├── invariant.test.ts
│   └── replay.test.ts
│
├── fixtures/
│   ├── basic.json
│   ├── duplicate.json
│   ├── out-of-order.json
│   ├── timestamp-conflict.json
│   ├── unauthorized-decrease.json
│   ├── legitimate-decrease.json
│   └── mixed.json
│
├── audit/
│   └── audit.jsonl
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## Setup

Clone the repository:

```bash
git clone <REPOSITORY_URL>
cd cross-chain-liquidity-reconciliation-engine
```

Install dependencies:

```bash
npm install
```

---

## Run the Engine

Start the HTTP server:

```bash
npm start
```

The server runs at:

```text
http://localhost:3000
```

---

## Run Tests

Run the complete automated test suite:

```bash
npm test
```

Build the TypeScript project:

```bash
npm run build
```

---

## Run a Fixture

```bash
npm run cli -- ingest fixtures/mixed.json
```

Replay the same fixture:

```bash
npm run cli -- replay fixtures/mixed.json
```

---

## Design Goals

The engine is designed around four core properties:

### Deterministic

The same ordered input events and configuration produce the same reconciliation decisions and state.

### Idempotent

Repeated processing of the same `event_id` does not mutate state.

### Replayable

Historical event sequences can be reapplied to reconstruct state transitions.

### Auditable

Every reconciliation decision records the event, reason, and state transition context.

---

## Security Model

The engine treats liquidity state as a security-sensitive observation rather than simply accepting the latest value.

Important protections include:

```text
Duplicate event
      ↓
No second state mutation

Stale event
      ↓
Ignored

Equal timestamp conflict
      ↓
Deterministic chain trust

Liquidity decrease without
on-chain evidence
      ↓
Rejected from state transition

Historical sequence
      ↓
Deterministic replay
```

The engine does not use ML/LLM-based conflict resolution, live blockchain calls, external databases, or distributed infrastructure.

---

## Current Scope

This implementation focuses on the deterministic reconciliation middleware and local simulation required for the MVP.

Blockchain interactions are represented by fixtures rather than live Ethereum, Base, or Arbitrum RPC calls.

Future extensions could include:

* Time-travel debugging
* Mock Chainlink Oracle integration
* Dynamic chain reliability weighting
* Richer CLI visualization
* Production persistence layer
* On-chain security enforcement integration

---

## License

MIT
