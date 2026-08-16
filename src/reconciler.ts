import { AuditTrail } from "./audit.js";

import {
  StateStore,
} from "./state.js";

import {
  CHAIN_TRUST,
  type AuditEntry,
  type ChainState,
  type LiquidityEvent,
  type ProcessResult,
  type SerializedState,
} from "./types.js";

export class ReconciliationEngine {
  readonly state: StateStore;

  readonly audit: AuditTrail;

  private readonly seenEventIds =
    new Set<string>();

  private readonly events =
    new Map<
      string,
      LiquidityEvent
    >();

  constructor(
    auditPath?: string,
  ) {
    this.state =
      new StateStore();

    this.audit =
      new AuditTrail(
        auditPath,
      );
  }

  process(
    event: LiquidityEvent,
  ): ProcessResult {
    /*
     * -------------------------
     * 1. IDEMPOTENCY
     * -------------------
     */

    if (
      this.seenEventIds.has(
        event.event_id,
      )
    ) {
      const current =
        this.state.getPair(
          event.tokenA,
          event.tokenB,
        );

      const state =
        current
          ? this.state.serializePair(
              current,
            )
          : null;

      const audit =
        this.record(
          event,
          "DUPLICATE_EVENT",
          `Event ${event.event_id} has already been processed; no state mutation performed.`,
          state,
          state,
        );

      return {
        statusCode: 409,
        decision:
          "DUPLICATE_EVENT",
        event_id:
          event.event_id,
        reason:
          audit.reason,
        state,
        audit,
      };
    }

    this.seenEventIds.add(
      event.event_id,
    );

    this.events.set(
      event.event_id,
      event,
    );

    const pair =
      this.state.getOrCreatePair(
        event.tokenA,
        event.tokenB,
      );

    const before =
      this.state.serializePair(
        pair,
      );

    const previous =
      pair.chains[
        event.chain
      ];


    if (
      previous &&
      event.timestamp <
        previous.timestamp
    ) {
      const audit =
        this.record(
          event,
          "STALE_UPDATE_IGNORED",
          `Incoming timestamp ${event.timestamp} is older than the current ${event.chain} timestamp ${previous.timestamp}.`,
          before,
          before,
        );

      return {
        statusCode: 200,
        decision:
          "STALE_UPDATE_IGNORED",
        event_id:
          event.event_id,
        reason:
          audit.reason,
        state: before,
        audit,
      };
    }


    if (
      previous &&
      event.liquidity <
        previous.liquidity &&
      event.source !== "router"
    ) {
      const audit =
        this.record(
          event,
          "LIQUIDITY_DECREASE_WITHOUT_ONCHAIN_EVENT",
          `Liquidity decreased on ${event.chain} from ${previous.liquidity} to ${event.liquidity} without a router-sourced on-chain event.`,
          before,
          before,
        );

      return {
        statusCode: 200,
        decision:
          "LIQUIDITY_DECREASE_WITHOUT_ONCHAIN_EVENT",
        event_id:
          event.event_id,
        reason:
          audit.reason,
        state: before,
        audit,
      };
    }

    

    const newState: ChainState = {
      ...event,
    };

    pair.chains[
      event.chain
    ] = newState;


    const oldCanonical =
      pair.canonical;

    const canonical =
      this.selectCanonical(
        pair,
      );

    pair.canonical =
      canonical;

    let decision:
      AuditEntry["decision"] =
      "ACCEPTED_NEW_STATE";

    let reason =
      `Accepted ${event.chain} state at timestamp ${event.timestamp}.`;

    /*
     * Timestamp tie between different chains.
     */

    if (
      oldCanonical &&
      canonical.timestamp ===
        oldCanonical.timestamp &&
      canonical.chain !==
        oldCanonical.chain
    ) {
      const selectedTrust =
        CHAIN_TRUST[
          canonical.chain
        ];

      const previousTrust =
        CHAIN_TRUST[
          oldCanonical.chain
        ];

      if (
        selectedTrust >
        previousTrust
      ) {
        decision =
          "TIMESTAMP_TIE_RESOLVED";

        reason =
          `Timestamp tie at ${canonical.timestamp}; ${canonical.chain} selected over ${oldCanonical.chain} using chain-of-trust precedence.`;
      }
    }

    

    const after =
      this.state.serializePair(
        pair,
      );

    const audit =
      this.record(
        event,
        decision,
        reason,
        before,
        after,
      );

    return {
      statusCode: 200,
      decision,
      event_id:
        event.event_id,
      reason,
      state: after,
      audit,
    };
  }

  private selectCanonical(
  pair: ReturnType<
    StateStore["getOrCreatePair"]
  >,
): ChainState {
  const states =
    Object.values(
      pair.chains,
    ).filter(
      Boolean,
    ) as ChainState[];

  if (
    states.length === 0
  ) {
    throw new Error(
      "Cannot select canonical state from empty pair",
    );
  }

  return states.reduce(
    (best, candidate) => {
      /*
       * Rule 1:
       * Newer timestamp wins.
       */

      if (
        candidate.timestamp >
        best.timestamp
      ) {
        return candidate;
      }

      if (
        candidate.timestamp <
        best.timestamp
      ) {
        return best;
      }

      /*
       * Rule 2:
       * Equal timestamps use
       * chain-of-trust.
       */

      return CHAIN_TRUST[candidate.chain] >
        CHAIN_TRUST[best.chain]
        ? candidate
        : best;
    },
  );
}

  private record(
    event: LiquidityEvent,
    decision:
      AuditEntry["decision"],
    reason: string,
    before:
      SerializedState | null,
    after:
      SerializedState | null,
  ): AuditEntry {
    const entry: AuditEntry =
      {
        event_id:
          event.event_id,
        decision,
        reason,
        timestamp:
          event.timestamp,
        state_before:
          before,
        state_after:
          after,
      };

    this.audit.add(
      entry,
    );

    return entry;
  }

  snapshot(): {
    state: SerializedState[];
  } {
    return {
      state:
        this.state.serializeAll(),
    };
  }

  auditEntries(): AuditEntry[] {
    return this.audit.all();
  }

  reset(): void {
    this.state.clear();
    this.seenEventIds.clear();
    this.audit.clear();
  }

  replay(
    eventIds: string[],
  ): {
    state: SerializedState[];
    audit: AuditEntry[];
  } {
    const events =
      eventIds.map(
        (id) => {
          const event =
            this.events.get(
              id,
            );

          if (!event) {
            throw new Error(
              `Unknown event_id: ${id}`,
            );
          }

          return event;
        },
      );

    this.state.clear();
    this.seenEventIds.clear();
    this.audit.clear();

    for (
      const event of events
    ) {
      this.process(event);
    }

    return {
      state:
        this.state.serializeAll(),
      audit:
        this.audit.all(),
    };
  }
}