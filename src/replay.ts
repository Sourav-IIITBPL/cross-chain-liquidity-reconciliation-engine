import type {
  AuditEntry,
  SerializedState,
} from "./types.js";

import {
  ReconciliationEngine,
} from "./reconciler.js";

export interface ReplayRequest {
  event_ids: string[];
}

export interface ReplayResult {
  event_ids: string[];
  state: SerializedState[];
  audit: AuditEntry[];
}

export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayError";
  }
}

export function validateReplayRequest(
  input: unknown,
): ReplayRequest {
  if (
    typeof input !== "object" ||
    input === null
  ) {
    throw new ReplayError(
      "Replay request must be an object",
    );
  }

  const body =
    input as Record<string, unknown>;

  if (!Array.isArray(body.event_ids)) {
    throw new ReplayError(
      "event_ids must be an array",
    );
  }

  if (body.event_ids.length === 0) {
    throw new ReplayError(
      "event_ids must contain at least one event ID",
    );
  }

  for (const eventId of body.event_ids) {
    if (
      typeof eventId !== "string" ||
      eventId.trim() === ""
    ) {
      throw new ReplayError(
        "Every event_id must be a non-empty string",
      );
    }
  }

  return {
    event_ids:
      body.event_ids.map(
        (eventId) => eventId.trim(),
      ),
  };
}

export function replayEvents(
  engine: ReconciliationEngine,
  input: unknown,
): ReplayResult {
  const request =
    validateReplayRequest(input);

  try {
    const result =
      engine.replay(
        request.event_ids,
      );

    return {
      event_ids:
        request.event_ids,
      state:
        result.state,
      audit:
        result.audit,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new ReplayError(
        error.message,
      );
    }

    throw new ReplayError(
      "Replay failed",
    );
  }
}