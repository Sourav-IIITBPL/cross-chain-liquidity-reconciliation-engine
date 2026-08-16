import type {
  RawLiquidityEvent,
} from "../src/types.js";

const TOKEN_A =
  "0x0000000000000000000000000000000000000001";

const TOKEN_B =
  "0x0000000000000000000000000000000000000002";

export function makeEvent(
  overrides: Partial<RawLiquidityEvent> = {},
): RawLiquidityEvent {
  return {
    chain: "Arbitrum",
    tokenA: TOKEN_A,
    tokenB: TOKEN_B,
    liquidity: "1000",
    timestamp: 1700000000,
    source: "router",
    event_id: "test-event-001",
    chain_id: 42161,
    ...overrides,
  };
}