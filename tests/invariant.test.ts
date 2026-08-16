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
  "temporal liquidity invariant",
  () => {
    it(
      "rejects a liquidity decrease from an oracle",
      () => {
        const engine =
          new ReconciliationEngine();

        processEvent(
          engine,
          {
            event_id:
              "router-initial",
            liquidity: "1500",
            timestamp: 100,
            source: "router",
          },
        );

        const result =
          processEvent(
            engine,
            {
              event_id:
                "oracle-decrease",
              liquidity: "1000",
              timestamp: 200,
              source: "oracle",
            },
          );

        expect(
          result.decision,
        ).toBe(
          "LIQUIDITY_DECREASE_WITHOUT_ONCHAIN_EVENT",
        );

        expect(
          result.state?.chains
            .Arbitrum?.liquidity,
        ).toBe("1500");
      },
    );

    it(
      "rejects a liquidity decrease from a bridge observation",
      () => {
        const engine =
          new ReconciliationEngine();

        processEvent(
          engine,
          {
            event_id:
              "router-initial-bridge",
            liquidity: "1500",
            timestamp: 100,
            source: "router",
          },
        );

        const result =
          processEvent(
            engine,
            {
              event_id:
                "bridge-decrease",
              liquidity: "900",
              timestamp: 200,
              source: "bridge",
            },
          );

        expect(
          result.decision,
        ).toBe(
          "LIQUIDITY_DECREASE_WITHOUT_ONCHAIN_EVENT",
        );

        expect(
          result.state?.chains
            .Arbitrum?.liquidity,
        ).toBe("1500");
      },
    );

    it(
      "allows a decrease backed by a router event",
      () => {
        const engine =
          new ReconciliationEngine();

        processEvent(
          engine,
          {
            event_id:
              "router-before-decrease",
            liquidity: "1500",
            timestamp: 100,
            source: "router",
          },
        );

        const result =
          processEvent(
            engine,
            {
              event_id:
                "router-legitimate-decrease",
              liquidity: "1000",
              timestamp: 200,
              source: "router",
            },
          );

        expect(
          result.decision,
        ).toBe(
          "ACCEPTED_NEW_STATE",
        );

        expect(
          result.state?.chains
            .Arbitrum?.liquidity,
        ).toBe("1000");
      },
    );

    it(
      "allows an increase from an oracle",
      () => {
        const engine =
          new ReconciliationEngine();

        processEvent(
          engine,
          {
            event_id:
              "oracle-initial",
            liquidity: "1000",
            timestamp: 100,
            source: "router",
          },
        );

        const result =
          processEvent(
            engine,
            {
              event_id:
                "oracle-increase",
              liquidity: "1500",
              timestamp: 200,
              source: "oracle",
            },
          );

        expect(
          result.decision,
        ).toBe(
          "ACCEPTED_NEW_STATE",
        );

        expect(
          result.state?.chains
            .Arbitrum?.liquidity,
        ).toBe("1500");
      },
    );
  },
);