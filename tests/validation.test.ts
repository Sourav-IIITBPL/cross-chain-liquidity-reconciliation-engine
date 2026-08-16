import {
  describe,
  expect,
  it,
} from "vitest";

import {
  normalizeEvent,
  ValidationError,
} from "../src/validation.js";

import {
  makeEvent,
} from "./helpers.js";

describe(
  "event validation and normalization",
  () => {
    it(
      "normalizes a valid event",
      () => {
        const event =
          normalizeEvent(
            makeEvent({
              liquidity:
                "1500000000000000000",
            }),
          );

        expect(
          event.chain,
        ).toBe("Arbitrum");

        expect(
          event.liquidity,
        ).toBe(
          1500000000000000000n,
        );

        expect(
          event.tokenA,
        ).toBe(
          "0x0000000000000000000000000000000000000001",
        );
      },
    );

    it(
      "normalizes token addresses to lowercase",
      () => {
        const event =
          normalizeEvent(
            makeEvent({
              tokenA:
                "0x000000000000000000000000000000000000000A",
            }),
          );

        expect(
          event.tokenA,
        ).toBe(
          "0x000000000000000000000000000000000000000a",
        );
      },
    );

    it(
      "rejects an unsupported chain",
      () => {
        expect(() =>
          normalizeEvent(
            makeEvent({
              chain: "Polygon",
            }),
          ),
        ).toThrow(
          ValidationError,
        );
      },
    );

    it(
      "rejects an invalid chain ID",
      () => {
        expect(() =>
          normalizeEvent(
            makeEvent({
              chain_id: 1,
            }),
          ),
        ).toThrow(
          ValidationError,
        );
      },
    );

    it(
      "rejects an invalid token address",
      () => {
        expect(() =>
          normalizeEvent(
            makeEvent({
              tokenA: "0x123",
            }),
          ),
        ).toThrow(
          ValidationError,
        );
      },
    );

    it(
      "rejects negative liquidity",
      () => {
        expect(() =>
          normalizeEvent(
            makeEvent({
              liquidity: "-100",
            }),
          ),
        ).toThrow(
          ValidationError,
        );
      },
    );

    it(
      "rejects empty event IDs",
      () => {
        expect(() =>
          normalizeEvent(
            makeEvent({
              event_id: "",
            }),
          ),
        ).toThrow(
          ValidationError,
        );
      },
    );

    it(
      "rejects identical token addresses",
      () => {
        expect(() =>
          normalizeEvent(
            makeEvent({
              tokenB:
                "0x0000000000000000000000000000000000000001",
            }),
          ),
        ).toThrow(
          ValidationError,
        );
      },
    );
  },
);