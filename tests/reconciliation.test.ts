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

function processEvent(
  engine: ReconciliationEngine,
  overrides: Parameters<
    typeof makeEvent
  >[0] = {},
) {
  return engine.process(
    normalizeEvent(
      makeEvent(overrides),
    ),
  );
}

describe(
  "reconciliation engine",
  () => {
    it(
      "accepts a new state",
      () => {
        const engine =
          new ReconciliationEngine();

        const result =
          processEvent(
            engine,
            {
              event_id:
                "accept-001",
              liquidity: "1000",
            },
          );

        expect(
          result.statusCode,
        ).toBe(200);

        expect(
          result.decision,
        ).toBe(
          "ACCEPTED_NEW_STATE",
        );

        expect(
          result.state?.canonical
            ?.liquidity,
        ).toBe("1000");
      },
    );

    it(
      "rejects duplicate event IDs",
      () => {
        const engine =
          new ReconciliationEngine();

        processEvent(
          engine,
          {
            event_id:
              "duplicate-001",
          },
        );

        const result =
          processEvent(
            engine,
            {
              event_id:
                "duplicate-001",
              liquidity: "9999",
            },
          );

        expect(
          result.statusCode,
        ).toBe(409);

        expect(
          result.decision,
        ).toBe(
          "DUPLICATE_EVENT",
        );

        expect(
          result.state?.canonical
            ?.liquidity,
        ).toBe("1000");
      },
    );

    it(
      "ignores an older timestamp on the same chain",
      () => {
        const engine =
          new ReconciliationEngine();

        processEvent(
          engine,
          {
            event_id:
              "newer-001",
            timestamp: 200,
            liquidity: "2000",
          },
        );

        const result =
          processEvent(
            engine,
            {
              event_id:
                "older-001",
              timestamp: 100,
              liquidity: "500",
            },
          );

        expect(
          result.decision,
        ).toBe(
          "STALE_UPDATE_IGNORED",
        );

        expect(
          result.state?.canonical
            ?.liquidity,
        ).toBe("2000");
      },
    );

    it(
      "prefers a newer timestamp across chains",
      () => {
        const engine =
          new ReconciliationEngine();

        processEvent(
          engine,
          {
            chain:
              "Ethereum",
            chain_id: 1,
            event_id:
              "eth-001",
            timestamp: 100,
            liquidity: "1000",
          },
        );

        const result =
          processEvent(
            engine,
            {
              chain:
                "Base",
              chain_id: 8453,
              event_id:
                "base-001",
              timestamp: 200,
              liquidity: "2000",
            },
          );

        expect(
          result.state?.canonical
            ?.chain,
        ).toBe("Base");

        expect(
          result.state?.canonical
            ?.liquidity,
        ).toBe("2000");
      },
    );

    it(
      "uses chain trust when timestamps are equal",
      () => {
        const engine =
          new ReconciliationEngine();

        processEvent(
          engine,
          {
            chain:
              "Ethereum",
            chain_id: 1,
            event_id:
              "eth-tie",
            timestamp: 100,
            liquidity: "1000",
          },
        );

        processEvent(
          engine,
          {
            chain:
              "Base",
            chain_id: 8453,
            event_id:
              "base-tie",
            timestamp: 100,
            liquidity: "2000",
          },
        );

        const result =
          processEvent(
            engine,
            {
              chain:
                "Arbitrum",
              chain_id: 42161,
              event_id:
                "arb-tie",
              timestamp: 100,
              liquidity: "3000",
            },
          );

        expect(
          result.state?.canonical
            ?.chain,
        ).toBe("Arbitrum");

        expect(
          result.state?.canonical
            ?.liquidity,
        ).toBe("3000");

        expect(
          result.decision,
        ).toBe(
          "TIMESTAMP_TIE_RESOLVED",
        );
      },
    );

    it(
      "does not let a lower-trust chain replace a higher-trust chain at equal timestamp",
      () => {
        const engine =
          new ReconciliationEngine();

        processEvent(
          engine,
          {
            chain:
              "Arbitrum",
            chain_id: 42161,
            event_id:
              "arb-first",
            timestamp: 100,
            liquidity: "3000",
          },
        );

        const result =
          processEvent(
            engine,
            {
              chain:
                "Ethereum",
              chain_id: 1,
              event_id:
                "eth-second",
              timestamp: 100,
              liquidity: "1000",
            },
          );

        expect(
          result.state?.canonical
            ?.chain,
        ).toBe("Arbitrum");

        expect(
          result.state?.canonical
            ?.liquidity,
        ).toBe("3000");
      },
    );

    it(
      "keeps per-chain states separate",
      () => {
        const engine =
          new ReconciliationEngine();

        processEvent(
          engine,
          {
            chain:
              "Ethereum",
            chain_id: 1,
            event_id:
              "eth-state",
            liquidity: "1000",
            timestamp: 100,
          },
        );

        processEvent(
          engine,
          {
            chain:
              "Base",
            chain_id: 8453,
            event_id:
              "base-state",
            liquidity: "2000",
            timestamp: 200,
          },
        );

        const state =
          engine.snapshot()
            .state[0];

        expect(
          state.chains.Ethereum
            ?.liquidity,
        ).toBe("1000");

        expect(
          state.chains.Base
            ?.liquidity,
        ).toBe("2000");
      },
    );
  },
);