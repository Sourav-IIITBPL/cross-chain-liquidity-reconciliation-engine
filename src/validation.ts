import {
  CHAIN_IDS,
  CHAINS,
  SOURCES,
  type Chain,
  type EventSource,
  type LiquidityEvent,
  type RawLiquidityEvent,
} from "./types.js";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function requiredString(
  value: unknown,
  field: string,
): string {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new ValidationError(
      `${field} must be a non-empty string`,
    );
  }

  return value.trim();
}

function parseLiquidity(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    if (
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      throw new ValidationError(
        "liquidity must be a non-negative integer",
      );
    }

    return BigInt(value);
  }

  if (
    typeof value === "string" &&
    /^\d+$/.test(value.trim())
  ) {
    return BigInt(value.trim());
  }

  throw new ValidationError(
    "liquidity must be a non-negative integer",
  );
}

function parseTimestamp(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new ValidationError(
      "timestamp must be a non-negative integer Unix timestamp",
    );
  }

  return value;
}

function parseChain(value: unknown): Chain {
  if (!CHAINS.includes(value as Chain)) {
    throw new ValidationError(
      "chain must be Ethereum, Base, or Arbitrum",
    );
  }

  return value as Chain;
}

function parseSource(value: unknown): EventSource {
  if (!SOURCES.includes(value as EventSource)) {
    throw new ValidationError(
      "source must be router, oracle, or bridge",
    );
  }

  return value as EventSource;
}

function parseChainId(
  value: unknown,
  chain: Chain,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value)
  ) {
    throw new ValidationError(
      "chain_id must be an integer",
    );
  }

  if (value !== CHAIN_IDS[chain]) {
    throw new ValidationError(
      `chain_id ${value} does not match ${chain} (${CHAIN_IDS[chain]})`,
    );
  }

  return value;
}

export function normalizeEvent(
  raw: RawLiquidityEvent,
): LiquidityEvent {
  const chain = parseChain(raw.chain);

  const tokenA = requiredString(
    raw.tokenA,
    "tokenA",
  );

  const tokenB = requiredString(
    raw.tokenB,
    "tokenB",
  );

  const event_id = requiredString(
    raw.event_id,
    "event_id",
  );

  const source = parseSource(raw.source);

  const timestamp = parseTimestamp(
    raw.timestamp,
  );

  const liquidity = parseLiquidity(
    raw.liquidity,
  );

  const chain_id = parseChainId(
    raw.chain_id,
    chain,
  );

  if (
    !ADDRESS_RE.test(tokenA) ||
    !ADDRESS_RE.test(tokenB)
  ) {
    throw new ValidationError(
      "tokenA and tokenB must be valid 20-byte hexadecimal addresses",
    );
  }

  if (
    tokenA.toLowerCase() ===
    tokenB.toLowerCase()
  ) {
    throw new ValidationError(
      "tokenA and tokenB must be different",
    );
  }

  return {
    chain,
    tokenA: tokenA.toLowerCase(),
    tokenB: tokenB.toLowerCase(),
    liquidity,
    timestamp,
    source,
    event_id,
    chain_id,
  };
}