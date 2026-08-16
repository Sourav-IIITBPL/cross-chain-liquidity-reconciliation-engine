import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ReconciliationEngine,
} from "../src/reconciler.js";

import {
  normalizeEvent,
} from "../src/validation.js";

import {
  makeEvent,
} from "./helpers.js";

describe(
  "deterministic replay",
  () => {
    it(
      "reproduces the same final state",
      () => {
        const engine =
          new ReconciliationEngine();

        const rawEvents = [
          makeEvent({
            chain:
              "Ethereum",
            chain_id: 1,
            event_id:
              "replay-eth",
            liquidity: "1000",
            timestamp: 100,
          }),

          makeEvent({
            chain:
              "Base",
            chain_id: 8453,
            event_id:
              "replay-base",
            liquidity: "1200",
            timestamp: 110,
          }),

          makeEvent({
            chain:
              "Arbitrum",
            chain_id: 42161,
            event_id:
              "replay-arb",
            liquidity: "1500",
            timestamp: 120,
          }),
        ];

        const events =
          rawEvents.map(
            normalizeEvent,
          );

        for (
          const event of events
        ) {
          engine.process(
            event,
          );
        }

        const originalState =
          engine.snapshot();

        const originalAudit =
          engine.auditEntries();

        const replay =
          engine.replay(
            events.map(
              (event) =>
                event.event_id,
            ),
          );

        expect(
          replay.state,
        ).toEqual(
          originalState.state,
        );

        expect(
          replay.audit,
        ).toEqual(
          originalAudit,
        );
      },
    );

    it(
      "preserves event ordering during replay",
      () => {
        const engine =
          new ReconciliationEngine();

        const events = [
          normalizeEvent(
            makeEvent({
              event_id:
                "order-1",
              timestamp: 100,
              liquidity: "1000",
            }),
          ),

          normalizeEvent(
            makeEvent({
              event_id:
                "order-2",
              timestamp: 200,
              liquidity: "2000",
            }),
          ),

          normalizeEvent(
            makeEvent({
              event_id:
                "order-3",
              timestamp: 150,
              liquidity: "1500",
            }),
          ),
        ];

        for (
          const event of events
        ) {
          engine.process(
            event,
          );
        }

        const replay =
          engine.replay(
            events.map(
              (event) =>
                event.event_id,
            ),
          );

        expect(
          replay.audit.map(
            (entry) =>
              entry.event_id,
          ),
        ).toEqual([
          "order-1",
          "order-2",
          "order-3",
        ]);

        expect(
          replay.state[0]
            ?.canonical
            ?.liquidity,
        ).toBe("2000");
      },
    );

    it(
      "produces identical results when replayed twice",
      () => {
        const engine =
          new ReconciliationEngine();

        const events = [
          normalizeEvent(
            makeEvent({
              event_id:
                "determinism-1",
              timestamp: 100,
              liquidity: "1000",
            }),
          ),

          normalizeEvent(
            makeEvent({
              chain:
                "Base",
              chain_id: 8453,
              event_id:
                "determinism-2",
              timestamp: 100,
              liquidity: "2000",
            }),
          ),

          normalizeEvent(
            makeEvent({
              chain:
                "Arbitrum",
              chain_id: 42161,
              event_id:
                "determinism-3",
              timestamp: 100,
              liquidity: "3000",
            }),
          ),
        ];

        for (
          const event of events
        ) {
          engine.process(
            event,
          );
        }

        const first =
          engine.replay(
            events.map(
              (event) =>
                event.event_id,
            ),
          );

        const second =
          engine.replay(
            events.map(
              (event) =>
                event.event_id,
            ),
          );

        expect(
          second.state,
        ).toEqual(
          first.state,
        );

        expect(
          second.audit,
        ).toEqual(
          first.audit,
        );
      },
    );

    it(
      "fails replay for an unknown event ID",
      () => {
        const engine =
          new ReconciliationEngine();

        expect(() =>
          engine.replay([
            "does-not-exist",
          ]),
        ).toThrow(
          "Unknown event_id: does-not-exist",
        );
      },
    );
  },
);