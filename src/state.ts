import type {
  Chain,
  ChainState,
  CanonicalState,
  PairState,
  SerializedState,
} from "./types.js";

export function pairKey(
  tokenA: string,
  tokenB: string,
): string {
  return [
    tokenA.toLowerCase(),
    tokenB.toLowerCase(),
  ]
    .sort()
    .join("/");
}

export class StateStore {
  private pairs = new Map<string, PairState>();

  clear(): void {
    this.pairs.clear();
  }

  getPair(
    tokenA: string,
    tokenB: string,
  ): PairState | undefined {
    return this.pairs.get(
      pairKey(tokenA, tokenB),
    );
  }

  getOrCreatePair(
    tokenA: string,
    tokenB: string,
  ): PairState {
    const key = pairKey(tokenA, tokenB);

    let state = this.pairs.get(key);

    if (!state) {
      state = {
        pairKey: key,
        chains: {},
        canonical: null,
      };

      this.pairs.set(key, state);
    }

    return state;
  }

  setChainState(
    state: ChainState,
  ): void {
    const pair =
      this.getOrCreatePair(
        state.tokenA,
        state.tokenB,
      );

    pair.chains[state.chain] = {
      ...state,
    };
  }

  setCanonical(
    canonical: CanonicalState,
  ): void {
    const pair =
      this.getOrCreatePair(
        canonical.tokenA,
        canonical.tokenB,
      );

    pair.canonical = {
      ...canonical,
    };
  }

  allPairs(): PairState[] {
    return [...this.pairs.values()];
  }

  serializePair(
    pair: PairState,
  ): SerializedState {
    const chains: SerializedState["chains"] =
      {};

    for (
      const [chain, state] of Object.entries(
        pair.chains,
      ) as [Chain, ChainState][]
    ) {
      if (!state) continue;

      chains[chain] = {
        chain: state.chain,
        tokenA: state.tokenA,
        tokenB: state.tokenB,
        liquidity:
          state.liquidity.toString(),
        timestamp: state.timestamp,
        source: state.source,
        event_id: state.event_id,
        chain_id: state.chain_id,
      };
    }

    const canonical =
      pair.canonical
        ? {
            chain:
              pair.canonical.chain,
            tokenA:
              pair.canonical.tokenA,
            tokenB:
              pair.canonical.tokenB,
            liquidity:
              pair.canonical.liquidity.toString(),
            timestamp:
              pair.canonical.timestamp,
            source:
              pair.canonical.source,
            event_id:
              pair.canonical.event_id,
            chain_id:
              pair.canonical.chain_id,
          }
        : null;

    return {
      pairKey: pair.pairKey,
      chains,
      canonical,
    };
  }

  serializeAll(): SerializedState[] {
    return this
      .allPairs()
      .sort((a, b) =>
        a.pairKey.localeCompare(
          b.pairKey,
        ),
      )
      .map((pair) =>
        this.serializePair(pair),
      );
  }
}