export const CHAINS = [
  "Ethereum",
  "Base",
  "Arbitrum",
] as const;

export type Chain = (typeof CHAINS)[number];

export const SOURCES = [
  "router",
  "oracle",
  "bridge",
] as const;

export type EventSource = (typeof SOURCES)[number];

export const CHAIN_IDS: Record<Chain, number> = {
  Ethereum: 1,
  Base: 8453,
  Arbitrum: 42161,
};

export const CHAIN_TRUST: Record<Chain, number> = {
  Ethereum: 1,
  Base: 2,
  Arbitrum: 3,
};

export interface LiquidityEvent {
  chain: Chain;
  tokenA: string;
  tokenB: string;
  liquidity: bigint;
  timestamp: number;
  source: EventSource;
  event_id: string;
  chain_id: number;
}

export interface RawLiquidityEvent {
  chain?: unknown;
  tokenA?: unknown;
  tokenB?: unknown;
  liquidity?: unknown;
  timestamp?: unknown;
  source?: unknown;
  event_id?: unknown;
  chain_id?: unknown;
  [key: string]: unknown;
}

export interface ChainState {
  chain: Chain;
  tokenA: string;
  tokenB: string;
  liquidity: bigint;
  timestamp: number;
  source: EventSource;
  event_id: string;
  chain_id: number;
}

export interface CanonicalState {
  chain: Chain;
  tokenA: string;
  tokenB: string;
  liquidity: bigint;
  timestamp: number;
  source: EventSource;
  event_id: string;
  chain_id: number;
}

export interface PairState {
  pairKey: string;
  chains: Partial<Record<Chain, ChainState>>;
  canonical: CanonicalState | null;
}

export type Decision =
  | "ACCEPTED_NEW_STATE"
  | "STALE_UPDATE_IGNORED"
  | "DUPLICATE_EVENT"
  | "TIMESTAMP_TIE_RESOLVED"
  | "LIQUIDITY_DECREASE_WITHOUT_ONCHAIN_EVENT"
  | "MALFORMED_EVENT";

export interface SerializedChainState {
  chain: Chain;
  tokenA: string;
  tokenB: string;
  liquidity: string;
  timestamp: number;
  source: EventSource;
  event_id: string;
  chain_id: number;
}

export interface SerializedState {
  pairKey: string;
  chains: Partial<Record<Chain, SerializedChainState>>;
  canonical: SerializedChainState | null;
}

export interface AuditEntry {
  event_id: string;
  decision: Decision;
  reason: string;
  timestamp: number;
  state_before: SerializedState | null;
  state_after: SerializedState | null;
}

export interface ProcessResult {
  statusCode: 200 | 400 | 409;
  decision: Decision;
  event_id?: string;
  reason: string;
  state: SerializedState | null;
  audit: AuditEntry;
}